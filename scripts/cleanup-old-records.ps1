<#
cleanup-old-records.ps1

Safe helper to identify and (optionally) delete old records for common tables:
- orders
- expenses
- payments
- driver_expenses
- shifts
- patrols

Features:
- Generates SQL delete statements for SQL Server and PostgreSQL
- Dry-run mode to show counts and SQL without executing
- Requires explicit DB type and connection info to run deletes
- Default age: 180 days (6 months). Change with -DaysOld

USAGE EXAMPLES:
# Dry-run (no DB needed): generate SQL files and show what would be deleted
.\cleanup-old-records.ps1 -DaysOld 180 -DryRun

# Execute against SQL Server (will ask for confirmation before running):
.\cleanup-old-records.ps1 -DbType sqlserver -ConnectionString "Server=...;Database=...;User Id=...;Password=...;" -DaysOld 365

# Execute against PostgreSQL (requires psql in PATH):
.\cleanup-old-records.ps1 -DbType postgres -ConnectionString "Host=...;Port=5432;Database=...;User Id=...;Password=...;" -DaysOld 365

IMPORTANT: Always BACKUP your database before running destructive operations. This script aims to be safe by default (dry-run) and requires explicit confirmation to perform deletes.
#>

param(
    [ValidateSet('sqlserver','postgres')]
    [string]$DbType = '',

    [string]$ConnectionString = '',

    [int]$DaysOld = 180,

    [switch]$DryRun,

    [switch]$Execute
n)

function Get-Timestamp { return (Get-Date).ToString('yyyy-MM-dd_HH-mm-ss') }

$ts = Get-Timestamp
$outDir = "$(Split-Path -Parent $MyInvocation.MyCommand.Path)\cleanup-output"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

# Tables and their created/updated timestamp column candidates (common names)
$tables = @(
    @{ name='orders'; col='created_at' },
    @{ name='expenses'; col='created_at' },
    @{ name='payments'; col='created_at' },
    @{ name='driver_expenses'; col='created_at' },
    @{ name='shifts'; col='created_at' },
    @{ name='patrols'; col='created_at' }
)

# SQL Server templates
$sqlServerSelectTmpl = "SELECT COUNT(*) AS Cnt FROM [{0}] WHERE [{1}] < DATEADD(day, -{2}, GETDATE());"
$sqlServerDeleteTmpl = "DELETE FROM [{0}] WHERE [{1}] < DATEADD(day, -{2}, GETDATE());"

# Postgres templates
$pgSelectTmpl = "SELECT COUNT(*) AS cnt FROM \"{0}\" WHERE \"{1}\" < (now() - INTERVAL '{2} days');"
$pgDeleteTmpl = "DELETE FROM \"{0}\" WHERE \"{1}\" < (now() - INTERVAL '{2} days');"

$selectSqlFile = Join-Path $outDir "select_counts_$ts.sql"
$deleteSqlFileSqlServer = Join-Path $outDir "delete_sqlserver_$ts.sql"
$deleteSqlFilePostgres = Join-Path $outDir "delete_postgres_$ts.sql"

"-- Generated on $(Get-Date)" | Out-File -FilePath $selectSqlFile -Encoding utf8
"-- SQL Server delete statements" | Out-File -FilePath $deleteSqlFileSqlServer -Encoding utf8
"-- Postgres delete statements" | Out-File -FilePath $deleteSqlFilePostgres -Encoding utf8

foreach ($t in $tables) {
    $name = $t.name
    $col = $t.col
    $sel = [string]::Format($sqlServerSelectTmpl, $name, $col, $DaysOld)
    $del = [string]::Format($sqlServerDeleteTmpl, $name, $col, $DaysOld)

    $pgSel = [string]::Format($pgSelectTmpl, $name, $col, $DaysOld)
    $pgDel = [string]::Format($pgDeleteTmpl, $name, $col, $DaysOld)

    $sel | Out-File -FilePath $selectSqlFile -Append -Encoding utf8
    $del | Out-File -FilePath $deleteSqlFileSqlServer -Append -Encoding utf8
    $pgSel | Out-File -FilePath $selectSqlFile -Append -Encoding utf8
    $pgDel | Out-File -FilePath $deleteSqlFilePostgres -Append -Encoding utf8
}

Write-Host "Generated SQL files in: $outDir" -ForegroundColor Cyan
Write-Host "  - Counts / diagnostic: $selectSqlFile" -ForegroundColor Yellow
Write-Host "  - SQL Server DELETE statements: $deleteSqlFileSqlServer" -ForegroundColor Yellow
Write-Host "  - Postgres DELETE statements: $deleteSqlFilePostgres" -ForegroundColor Yellow

if ($DryRun -or (-not $DbType) -or (-not $ConnectionString)) {
    Write-Host "Dry-run mode or missing DB info — not executing statements." -ForegroundColor Green
    Write-Host "Review the generated SQL files and run with -DbType and -ConnectionString and -Execute to apply." -ForegroundColor Green
    exit 0
}

# If we reach here, DbType and ConnectionString were provided. Require explicit -Execute switch to run deletes.
if (-not $Execute) {
    Write-Host "DbType and ConnectionString provided but -Execute not given. The script will only show counts. Pass -Execute to actually run deletes after confirming." -ForegroundColor Yellow
}

function Run-SqlServerQuery([string]$conn, [string]$query) {
    try {
        # Use System.Data.SqlClient (works on Windows PowerShell / .NET Framework)
        $cn = New-Object System.Data.SqlClient.SqlConnection $conn
        $cn.Open()
        $cmd = $cn.CreateCommand()
        $cmd.CommandText = $query
        $res = $cmd.ExecuteScalar()
        $cn.Close()
        return $res
    }
    catch {
        Write-Warning "Failed to run SQL Server query: $_"
        return $null
    }
}

function Run-PostgresQueryUsingPsql([string]$connStr, [string]$query) {
    # This is a helper that expects psql to be available and PG connection details in connStr
    # connStr expected format: "Host=...;Port=5432;Database=...;User Id=...;Password=...;"
    $props = @{}
    foreach ($part in $connStr.Split(';') | Where-Object { $_ -match '=' }) {
        $kv = $part.Split('=')
        $props[$kv[0].Trim()] = $kv[1].Trim()
    }
    $host = $props['Host']
    $port = $props['Port']
    $db = $props['Database']
    $user = $props['User Id']
    $pwd = $props['Password']

    if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
        Write-Warning "psql is not available in PATH. Cannot run Postgres queries automatically."
        return $null
    }

    $env:PGPASSWORD = $pwd
    $args = @('-h',$host,'-p',$port,'-U',$user,'-d',$db,'-t','-c',$query)
    $out = & psql @args
    $env:PGPASSWORD = $null
    return $out.Trim()
}

# Show counts for each table
Write-Host "Diagnostic counts for tables older than $DaysOld days:" -ForegroundColor Cyan
foreach ($t in $tables) {
    $name = $t.name
    $col = $t.col
    if ($DbType -eq 'sqlserver') {
        $q = [string]::Format($sqlServerSelectTmpl, $name, $col, $DaysOld)
        $cnt = Run-SqlServerQuery -conn $ConnectionString -query $q
        Write-Host "  $name : $cnt" -ForegroundColor Green
    }
    elseif ($DbType -eq 'postgres') {
        $q = [string]::Format($pgSelectTmpl, $name, $col, $DaysOld)
        $out = Run-PostgresQueryUsingPsql -connStr $ConnectionString -query $q
        Write-Host "  $name : $out" -ForegroundColor Green
    }
}

if (-not $Execute) { exit 0 }

# Confirmation prompt
Write-Host "WARNING: You are about to DELETE records older than $DaysOld days from the listed tables." -ForegroundColor Red
$confirm = Read-Host "Type 'DELETE' to confirm and proceed"
if ($confirm -ne 'DELETE') { Write-Host "Aborting — confirmation not provided."; exit 1 }

# Perform deletes
if ($DbType -eq 'sqlserver') {
    $sql = Get-Content -Raw -Path $deleteSqlFileSqlServer
    try {
        $cn = New-Object System.Data.SqlClient.SqlConnection $ConnectionString
        $cn.Open()
        $cmd = $cn.CreateCommand()
        $cmd.CommandText = $sql
        $affected = $cmd.ExecuteNonQuery()
        $cn.Close()
        Write-Host "Delete statements executed. Affected rows (approx.): $affected" -ForegroundColor Magenta
    }
    catch {
        Write-Error "Failed to execute deletes: $_"
        exit 2
    }
}
elseif ($DbType -eq 'postgres') {
    if (-not (Get-Command psql -ErrorAction SilentlyContinue)) { Write-Error "psql not found in PATH — cannot execute Postgres deletes."; exit 3 }
    $sql = Get-Content -Raw -Path $deleteSqlFilePostgres
    $props = @{}
    foreach ($part in $ConnectionString.Split(';') | Where-Object { $_ -match '=' }) {
        $kv = $part.Split('=')
        $props[$kv[0].Trim()] = $kv[1].Trim()
    }
    $env:PGPASSWORD = $props['Password']
    $args = @('-h',$props['Host'],'-p',$props['Port'],'-U',$props['User Id'],'-d',$props['Database'],'-c',$sql)
    & psql @args
    $env:PGPASSWORD = $null
    Write-Host "Postgres delete statements executed (if psql ran successfully)." -ForegroundColor Magenta
}

Write-Host "Done." -ForegroundColor Cyan
