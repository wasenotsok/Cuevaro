# Owner-operated masked entry. Process-only, no files/persistent environment/login.
param([ValidateSet('ReadProbe','RuntimeCheck','ManagedApi','ManagedWorker')][string]$Mode = 'ReadProbe')
$ErrorActionPreference = 'Stop'
$names = if ($Mode -in @('ManagedApi','ManagedWorker')) { @('CUEVARO_SUPABASE_PUBLISHABLE_KEY','CUEVARO_SUPABASE_SERVICE_ROLE_KEY','CUEVARO_POSTGRES_HOST','CUEVARO_POSTGRES_USER','CUEVARO_POSTGRES_PASSWORD') } elseif ($Mode -eq 'RuntimeCheck') { @('CUEVARO_SUPABASE_PUBLISHABLE_KEY','CUEVARO_SUPABASE_SERVICE_ROLE_KEY') } else { @('CUEVARO_SUPABASE_PUBLISHABLE_KEY','CUEVARO_APPROVED_USER_TOKEN','CUEVARO_TEST_HOUSEHOLD_ID','CUEVARO_TEST_ORIGINAL_PATH','CUEVARO_OTHER_APPROVED_USER_TOKEN') }
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name,'Process') }
try {
  foreach ($name in $names) {
    if ([Environment]::GetEnvironmentVariable($name,'Process')) { continue }
    $entry = Read-Host -Prompt "$name (optional only for OTHER_APPROVED_USER_TOKEN)" -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($entry)
    try { [Environment]::SetEnvironmentVariable($name,[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr),'Process') }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr); $entry.Dispose() }
  }
  Push-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
  try {
    $target = switch ($Mode) { 'RuntimeCheck' { 'scripts/check-managed-runtime.ts' }; 'ManagedApi' { 'scripts/start-managed-api.ts' }; 'ManagedWorker' { 'scripts/start-managed-worker.ts' }; default { 'scripts/verify-managed-read-access.ts' } }
    & node --import tsx $target
    $probeExit = $LASTEXITCODE
  } finally { Pop-Location }
} finally {
  foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name,$previous[$name],'Process') }
  $previous.Clear()
}
exit $probeExit
