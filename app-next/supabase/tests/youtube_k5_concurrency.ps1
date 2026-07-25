$ErrorActionPreference = "Stop"

$containerName = "supabase_db_app-next"
$sourceId = "91000000-0000-0000-0000-000000000001"
$trackId = "91000000-0000-0000-0000-000000000010"
$sourceKey = "youtube_k5_concurrency"
$periodKey = "2099-03-01::2099-03-08"
$ownerToken = "k5-concurrency-owner"

function Invoke-LocalSql {
  param([Parameter(Mandatory = $true)][string]$Sql)
  $output = & docker exec $containerName psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atc $Sql
  if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL command failed."
  }
  return $output
}

$cleanupSql = @"
delete from public.youtube_sync_leases where source_key = '$sourceKey';
delete from public.sync_runs where chart_source_id = '$sourceId'::uuid;
delete from public.chart_sources where id = '$sourceId'::uuid;
delete from public.tracks where id = '$trackId'::uuid;
"@

try {
  Invoke-LocalSql -Sql $cleanupSql | Out-Null
  Invoke-LocalSql -Sql @"
insert into public.chart_sources (
  id, platform, source_key, display_name, ingestion_mode, is_enabled, is_automatic
) values (
  '$sourceId'::uuid, 'youtube', '$sourceKey', 'K5 concurrency',
  'OFFICIAL_API', true, true
);
insert into public.tracks (id, title, normalized_title)
values ('$trackId'::uuid, 'K5 concurrency track', 'k5 concurrency track');
"@ | Out-Null

  $runOutput = Invoke-LocalSql -Sql @"
select run_id
from public.acquire_sync_lease(
  '$sourceKey', '$periodKey', '$ownerToken', 300, '$sourceId'::uuid
);
"@
  $runId = ($runOutput | Select-Object -Last 1).Trim()

  if (-not $runId) {
    throw "The concurrency lease did not return a run id."
  }

  $entryOne = @"
jsonb_build_array(jsonb_build_object(
  'track_id', '$trackId',
  'metric_value', 111,
  'delta_views', 111,
  'delta_likes', 11,
  'delta_comments', 1,
  'total_views', 1111,
  'eligible_video_count', 1,
  'raw_artist_text', 'K5',
  'raw_track_title', 'Concurrency'
))
"@
  $entryTwo = $entryOne.Replace(
    "'metric_value', 111", "'metric_value', 222"
  ).Replace(
    "'delta_views', 111", "'delta_views', 222"
  ).Replace(
    "'total_views', 1111", "'total_views', 2222"
  )

  $queryOne = @"
begin;
select success
from public.fenced_upsert_youtube_draft(
  '$sourceKey', '$periodKey', '$ownerToken', '$runId'::uuid,
  '$sourceId'::uuid, '2099-03-01T00:00:00Z', '2099-03-08T00:00:00Z',
  $entryOne, 'draft', null
);
select pg_sleep(2);
commit;
"@
  $queryTwo = @"
begin;
select success
from public.fenced_upsert_youtube_draft(
  '$sourceKey', '$periodKey', '$ownerToken', '$runId'::uuid,
  '$sourceId'::uuid, '2099-03-01T00:00:00Z', '2099-03-08T00:00:00Z',
  $entryTwo, 'draft', null
);
commit;
"@

  $jobScript = {
    param($container, $query)
    $result = & docker exec $container psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atc $query
    if ($LASTEXITCODE -ne 0) {
      throw "Concurrent PostgreSQL session failed."
    }
    $result
  }

  $first = Start-Job -ScriptBlock $jobScript -ArgumentList $containerName, $queryOne
  Start-Sleep -Milliseconds 150
  $second = Start-Job -ScriptBlock $jobScript -ArgumentList $containerName, $queryTwo
  Wait-Job -Job $first, $second | Out-Null
  $firstOutput = Receive-Job -Job $first
  $secondOutput = Receive-Job -Job $second
  Remove-Job -Job $first, $second

  if ($firstOutput -notcontains "t" -or $secondOutput -notcontains "t") {
    throw "Both concurrent draft calls must succeed after serialization."
  }

  $verification = Invoke-LocalSql -Sql @"
select
  count(distinct ed.id),
  count(ce.id),
  min(ce.metric_value)::bigint in (111, 222)
from public.chart_editions ed
join public.chart_entries ce on ce.chart_edition_id = ed.id
where ed.chart_source_id = '$sourceId'::uuid
  and ed.period_start = '2099-03-01T00:00:00Z'
  and ed.period_end = '2099-03-08T00:00:00Z';
"@

  if (($verification | Select-Object -Last 1).Trim() -ne "1|1|t") {
    throw "Concurrent writes produced a duplicate or partial draft: $verification"
  }

  Write-Output "K5 concurrency passed: 2 parallel sessions, 1 edition, 1 complete entry"
}
finally {
  Invoke-LocalSql -Sql $cleanupSql | Out-Null
}
