# Uses a disposable PostgreSQL instance without exposing ports or reading application secrets.
$ErrorActionPreference = 'Stop'
$containerName = 'flowly-assistant-test-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$supabaseRoot = Split-Path $PSScriptRoot -Parent
$started = $false
try {
  docker run --rm -d --name $containerName -e POSTGRES_PASSWORD=flowly-test-only postgres:16-alpine
  if ($LASTEXITCODE -ne 0) { throw 'Could not start test PostgreSQL' }
  $started = $true
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    docker exec $containerName pg_isready -h 127.0.0.1 -U postgres 2>$null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 1
  }
  docker cp $supabaseRoot "${containerName}:/tmp/supabase"
  if ($LASTEXITCODE -ne 0) { throw 'Could not copy migrations' }
  docker exec $containerName psql -U postgres -v ON_ERROR_STOP=1 -f /tmp/supabase/tests/assistant-bootstrap.sql
  if ($LASTEXITCODE -ne 0) { throw 'Bootstrap failed' }
  Get-ChildItem -LiteralPath (Join-Path $supabaseRoot 'migrations') -Filter '*.sql' | Sort-Object Name | ForEach-Object {
    docker exec $containerName psql -U postgres -v ON_ERROR_STOP=1 -f ('/tmp/supabase/migrations/' + $_.Name)
    if ($LASTEXITCODE -ne 0) { throw ('Migration failed: ' + $_.Name) }
  }
  docker exec $containerName psql -U postgres -v ON_ERROR_STOP=1 -f /tmp/supabase/tests/assistant.sql
  if ($LASTEXITCODE -ne 0) { throw 'Assistant database assertions failed' }
  docker exec $containerName psql -U postgres -v ON_ERROR_STOP=1 -f /tmp/supabase/tests/assistant-concurrency.sql
  if ($LASTEXITCODE -ne 0) { throw 'Concurrency setup failed' }
  $jobs = 1..2 | ForEach-Object {
    Start-Job -ArgumentList $containerName, $_ -ScriptBlock {
      param($name, $number)
      $sql = "begin; set local role authenticated; select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true); select public.assistant_reserve('ffffffff-ffff-4fff-8fff-ffffffffffff',gen_random_uuid(),'concurrent $number','2026-10-01'); select pg_sleep(1); commit;"
      docker exec $name psql -U postgres -v ON_ERROR_STOP=1 -Atc $sql
      if ($LASTEXITCODE -ne 0) { throw 'Concurrent reservation failed' }
    }
  }
  $jobs | Wait-Job -Timeout 30 | Out-Null
  if ($jobs.State -contains 'Running' -or $jobs.State -contains 'Failed') { throw 'Concurrent test did not finish successfully' }
  $output = $jobs | Receive-Job
  $jobs | Remove-Job
  $statuses = $output | Where-Object { $_ -match '^\{.*"status"' } | ForEach-Object { ($_ | ConvertFrom-Json).status } | Sort-Object
  if (($statuses -join ',') -ne 'busy,reserved') { throw ('Concurrent reservations were not serialized: ' + ($statuses -join ',')) }
  Write-Output 'Concurrent reservation assertions passed'
} finally {
  if ($started) { docker stop $containerName | Out-Null }
}
