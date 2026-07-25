$ErrorActionPreference = "Stop"

$containerName = "supabase_db_app-next"
$editionId = "93000000-0000-4000-8000-000000000001"
$channelId = "UCK7Concurrency000000001"
$videoId = "93000000-0000-4000-8000-000000000002"
$trackId = "33333333-0000-0000-0000-000000000001"
$userId = "93000000-0000-4000-8000-000000000003"

function Invoke-Sql {
  param([string]$Sql)
  $result = & docker exec $containerName psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atc $Sql
  if ($LASTEXITCODE -ne 0) { throw "PostgreSQL command failed." }
  return $result
}

$cleanup = @"
delete from public.youtube_chart_publications where chart_edition_id = '$editionId'::uuid;
delete from public.chart_published_snapshots where edition_id = '$editionId'::uuid;
delete from public.chart_entries where chart_edition_id = '$editionId'::uuid;
delete from public.chart_editions where id = '$editionId'::uuid;
delete from public.youtube_track_assets where youtube_video_id = '$videoId'::uuid;
delete from public.youtube_videos where id = '$videoId'::uuid;
delete from public.youtube_channels where channel_id = '$channelId';
"@

try {
  Invoke-Sql $cleanup | Out-Null
  Invoke-Sql @"
insert into public.youtube_channels(channel_id, channel_title, status, is_active, is_youtube_verified)
values ('$channelId', 'K7 concurrent channel', 'active', true, true);
insert into public.youtube_videos(
  id, video_id, channel_id, source_title, published_at, review_status,
  video_type, is_eligible, is_active, track_id
) values (
  '$videoId'::uuid, 'K7Concur01A', '$channelId', 'K7 concurrent video',
  '2099-01-01', 'APPROVED', 'OFFICIAL_MUSIC_VIDEO', true, true, '$trackId'::uuid
);
insert into public.youtube_track_assets(track_id, youtube_video_id, asset_role, is_eligible)
values ('$trackId'::uuid, '$videoId'::uuid, 'primary', true);
insert into public.chart_editions(
  id, chart_source_id, period_start, period_end, status
) select '$editionId'::uuid, id, '2099-01-01', '2099-01-08', 'ready'
from public.chart_sources where source_key = 'youtube_hmi_weekly_delta';
insert into public.chart_entries(
  chart_edition_id, track_id, source_position, filtered_position, metric_value,
  metric_unit, delta_views, delta_likes, delta_comments, total_views,
  eligible_video_count
) values (
  '$editionId'::uuid, '$trackId'::uuid, 1, 1, 100, 'views', 100, 1, 1, 100, 1
);
"@ | Out-Null

  $query = @"
begin;
select success from public.publish_youtube_chart(
  '$editionId'::uuid,
  jsonb_build_object(
    'entries', jsonb_build_array(jsonb_build_object(
      'filtered_position', 1, 'track_id', '$trackId', 'metric_value', 100
    ))
  ),
  '[]'::jsonb,
  'K7 concurrent methodology', '$userId'::uuid, null
);
select pg_sleep(2);
commit;
"@
  $jobScript = {
    param($container, $sql)
    & docker exec $container psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atc $sql
    if ($LASTEXITCODE -ne 0) { throw "Concurrent publication failed." }
  }
  $first = Start-Job -ScriptBlock $jobScript -ArgumentList $containerName, $query
  Start-Sleep -Milliseconds 150
  $second = Start-Job -ScriptBlock $jobScript -ArgumentList $containerName, $query
  Wait-Job $first, $second | Out-Null
  $firstOutput = (Receive-Job $first) -join "`n"
  $secondOutput = (Receive-Job $second) -join "`n"
  Remove-Job $first, $second
  $output = $firstOutput + "`n" + $secondOutput
  $flags = @(($output -split "\r?\n") | Where-Object { $_ -in @("t", "f") })
  if (($flags | Where-Object { $_ -eq "t" }).Count -ne 1 -or
      ($flags | Where-Object { $_ -eq "f" }).Count -ne 1) {
    throw "Exactly one concurrent publication must win: $output"
  }
  $count = Invoke-Sql "select count(*) from public.youtube_chart_publications where chart_edition_id = '$editionId'::uuid;"
  if (($count | Select-Object -Last 1).Trim() -ne "1") {
    throw "Concurrent publication created more than one immutable version."
  }
  Write-Output "K7 concurrency passed: exactly one publication won and public state stayed atomic"
}
finally {
  Invoke-Sql $cleanup | Out-Null
}
