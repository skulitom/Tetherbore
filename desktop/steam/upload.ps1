# Uploads the packaged Windows build to Steam, on no public branch: nobody can install it until it is set live by hand
# in Steamworks (SteamPipe > Builds).
#
#   node desktop/package.mjs
#   powershell -File desktop/steam/upload.ps1 -SteamCmd C:\path\to\steamcmd.exe -Account yourSteamAccountName
#
# SteamCMD asks for the password and Steam Guard itself, in this window, and remembers the sign-in afterwards. Nothing
# here reads or stores them. SteamCMD comes with the Steamworks SDK (tools/ContentBuilder/builder/steamcmd.exe).
param(
  [Parameter(Mandatory = $true)][string]$SteamCmd,
  [Parameter(Mandatory = $true)][string]$Account,
  [string]$Description = "Tetherbore $(git -C $PSScriptRoot rev-parse --short HEAD)"
)
$ErrorActionPreference = 'Stop'

$content = Resolve-Path (Join-Path $PSScriptRoot '..\out\Tetherbore-win32-x64')
if (-not (Test-Path (Join-Path $content 'Tetherbore.exe'))) { throw "No build at $content. Run: node desktop/package.mjs" }
if (Test-Path (Join-Path $content 'steam_appid.txt')) { throw 'The build holds a steam_appid.txt, which must not ship.' }

$work = Join-Path $env:TEMP 'tetherbore-steampipe'
New-Item -ItemType Directory -Force -Path $work | Out-Null
$safe = $Description -replace '"', "'"
$vdf = Join-Path $work 'app_build_5681650.vdf'
@"
"AppBuild"
{
  "AppID" "5681650"
  "Desc" "$safe"
  "ContentRoot" "$($content -replace '\\', '\\')"
  "BuildOutput" "$($work -replace '\\', '\\')\\output"
  "Depots"
  {
    "5681651"
    {
      "FileMapping"
      {
        "LocalPath" "*"
        "DepotPath" "."
        "Recursive" "1"
      }
    }
  }
}
"@ | Set-Content -Encoding ascii -Path $vdf

& $SteamCmd +login $Account +run_app_build $vdf +quit
if ($LASTEXITCODE -ne 0) { throw "SteamCMD failed with exit code $LASTEXITCODE" }
Write-Host 'Uploaded. Set it live on a private branch at https://partner.steamgames.com/apps/builds/5681650'
