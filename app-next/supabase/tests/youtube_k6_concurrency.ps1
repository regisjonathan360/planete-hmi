$ErrorActionPreference = "Stop"

$containerName = "supabase_db_app-next"
$sourceId = "92000000-0000-4000-8000-000000000001"
$sourceKey = "youtube_k6_concurrency"
$periodKey = "2099-04-01::2099-04-08"
$channelUuid = "92000000-0000-4000-8000-000000000002"
$channelId = "UCK6Concurrency000000001"
$videoUuid = "92000000-0000-4000-8000-000000000003"
$trackOne = "92000000-0000-4000-8000-000000000010"
$trackTwo = "92000000-0000-4000-8000-000000000011"

function Invoke-LocalSql {
  param([Parameter(Mandatory = $true)][string]$Sql)
  $output = & docker exec $containerName psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atc $Sql
  if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL command failed."
  }
  return $output
}

function Invoke-ParallelSql {
  param(
    [Parameter(Mandatory = $true)][string]$FirstQuery,
    [Parameter(Mandatory = $true)][string]$SecondQuery
  )
  $jobScript = {
    param($container, $query)
    $result = & docker exec $container psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atc $query
    if ($LASTEXITCODE -ne 0) {
      throw "Concurrent PostgreSQL session failed."
    }
    $result
  }

  $first = Start-Job -ScriptBlock $jobScript -ArgumentList $containerName, $FirstQuery
  Start-Sleep -Milliseconds 150
  $second = Start-Job -ScriptBlock $jobScript -ArgumentList $containerName, $SecondQuery
  Wait-Job -Job $first, $second | Out-Null
  $firstOutput = Receive-Job -Job $first
  $secondOutput = Receive-Job -Job $second
  Remove-Job -Job $first, $second
  return [pscustomobject]@{
    First = ($firstOutput -join "`n")
    Second = ($secondOutput -join "`n")
  }
}

$cleanupSql = @"
delete from public.youtube_sync_leases where source_key = '$sourceKey';
delete from public.sync_runs where chart_source_id = '$sourceId'::uuid;
delete from public.youtube_track_assets where youtube_video_id = '$videoUuid'::uuid;
delete from public.youtube_videos where id = '$videoUuid'::uuid;
delete from public.youtube_channels where id = '$channelUuid'::uuid;
delete from public.tracks where id in ('$trackOne'::uuid, '$trackTwo'::uuid);
delete from public.chart_sources where id = '$sourceId'::uuid;
"@

try {
  Invoke-LocalSql -Sql $cleanupSql | Out-Null
  Invoke-LocalSql -Sql @"
insert into public.chart_sources (
  id, platform, source_key, display_name, ingestion_mode, is_enabled
) values (
  '$sourceId'::uuid, 'youtube', '$sourceKey', 'K6 concurrency',
  'OFFICIAL_API', true
);
insert into public.tracks (id, title, normalized_title) values
  ('$trackOne'::uuid, 'K6 concurrent track one', 'k6 concurrent track one'),
  ('$trackTwo'::uuid, 'K6 concurrent track two', 'k6 concurrent track two');
insert into public.youtube_channels (
  id, channel_id, channel_title, channel_type, is_active, status, is_youtube_verified
) values (
  '$channelUuid'::uuid, '$channelId', 'K6 concurrent channel',
  'OFFICIAL_ARTIST_CHANNEL', true, 'active', true
);
insert into public.youtube_videos (
  id, video_id, channel_id, source_title, published_at
) values (
  '$videoUuid'::uuid, 'K6Concur01A', '$channelId',
  'K6 concurrent video', clock_timestamp()
);
"@ | Out-Null

  $collectQuery = @"
begin;
select acquired from public.acquire_sync_lease(
  '$sourceKey', '$periodKey', 'collect-owner', 300, '$sourceId'::uuid
);
select pg_sleep(2);
commit;
"@
  $recalculateQuery = @"
begin;
select acquired from public.acquire_recalculate_lease(
  '$sourceKey', '$periodKey', 'recalculate-owner', 300, '$sourceId'::uuid
);
commit;
"@
  $leaseOutputs = Invoke-ParallelSql -FirstQuery $collectQuery -SecondQuery $recalculateQuery
  $leaseFlags = @((
    $leaseOutputs.First + "`n" + $leaseOutputs.Second
  ) -split "\r?\n" | Where-Object { $_ -in @("t", "f") })
  if (($leaseFlags | Where-Object { $_ -eq "t" }).Count -ne 1 -or
      ($leaseFlags | Where-Object { $_ -eq "f" }).Count -ne 1) {
    throw "Exactly one concurrent lease acquisition must win: $leaseOutputs"
  }

  Invoke-LocalSql -Sql @"
update public.youtube_sync_leases
set expires_at = clock_timestamp() - interval '1 second'
where source_key = '$sourceKey' and period_key = '$periodKey';
"@ | Out-Null
  $takeover = Invoke-LocalSql -Sql @"
select acquired from public.acquire_recalculate_lease(
  '$sourceKey', '$periodKey', 'new-owner', 300, '$sourceId'::uuid
);
"@
  if (($takeover | Select-Object -Last 1).Trim() -ne "t") {
    throw "The expired lease takeover must succeed."
  }
  $staleWrite = Invoke-LocalSql -Sql @"
select public.fenced_update_sync_run(
  '$sourceKey', '$periodKey', 'collect-owner',
  (select sync_run_id from public.youtube_sync_leases
   where source_key = '$sourceKey' and period_key = '$periodKey'),
  'COMPLETED', clock_timestamp(), null, null, null, null, null, null, null, false
);
"@
  if (($staleWrite | Select-Object -Last 1).Trim() -ne "f") {
    throw "The stale owner must not write after takeover."
  }

  $linkOne = @"
begin;
select success from public.link_youtube_video_to_track(
  '$videoUuid'::uuid, '$trackOne'::uuid, 'primary', true, null
);
select pg_sleep(2);
commit;
"@
  $linkTwo = @"
begin;
select success from public.link_youtube_video_to_track(
  '$videoUuid'::uuid, '$trackTwo'::uuid, 'primary', true, null
);
commit;
"@
  $linkOutputs = Invoke-ParallelSql -FirstQuery $linkOne -SecondQuery $linkTwo
  $linkFlags = @((
    $linkOutputs.First + "`n" + $linkOutputs.Second
  ) -split "\r?\n" | Where-Object { $_ -eq "t" })
  if ($linkFlags.Count -ne 2) {
    throw "Both serialized link operations must succeed: $linkOutputs"
  }

  $associationCheck = Invoke-LocalSql -Sql @"
select
  (select count(*) = 1
   from public.youtube_track_assets
   where youtube_video_id = '$videoUuid'::uuid),
  not exists (
    select 1
    from public.youtube_track_assets a
    join public.youtube_videos v on v.id = a.youtube_video_id
    where a.youtube_video_id = '$videoUuid'::uuid
      and a.track_id <> v.track_id
  );
"@
  if (($associationCheck | Select-Object -Last 1).Trim() -ne "t|t") {
    throw "Concurrent links left contradictory associations: $associationCheck"
  }

  Write-Output "K6 concurrency passed: lease 1 winner, stale owner fenced, link operations serialized"
}
finally {
  Invoke-LocalSql -Sql $cleanupSql | Out-Null
}
