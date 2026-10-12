# Mutation check: reintroduce each fixed defect, confirm the matching test fails.
# Proves the suite can actually fail. Run from the app folder:  powershell -File tests/mutation-check.ps1
$ErrorActionPreference = 'Stop'
$p = Join-Path $PSScriptRoot '..\index.html'
$orig = [IO.File]::ReadAllText($p)
$mutations = @(
  @{ n = 'XSS in lblSpan';         find = "+ sanitizeForReport(t) + '</span>'; }"; repl = "+ t + '</span>'; }" },
  @{ n = 'no beforeprint';         find = "window.addEventListener('beforeprint', function () {"; repl = "window.addEventListener('__x_beforeprint', function () {" },
  @{ n = 'applyLayout wipes peek'; find = "if (wasPeek && effective === 'layout-folded') ws.classList.add('peek-open');"; repl = "" },
  @{ n = 'QR loop back to v10';    find = "for (var v = 1; v <= 40; v++) {"; repl = "for (var v = 1; v <= 10; v++) {" },
  @{ n = 'field pill ignored';     find = "if (isOn('serial')) i1.push(lblSpan('Serial No')"; repl = "if (true) i1.push(lblSpan('Serial No')" }
)
$patch = Join-Path $PSScriptRoot '..\Modules\render-patch.js'
$patchOrig = [IO.File]::ReadAllText($patch)
$failed = 0
foreach ($m in $mutations) {
  if ($orig -notlike "*$($m.find)*") { Write-Host "SKIP (pattern not found): $($m.n)"; continue }
  [IO.File]::WriteAllText($p, $orig.Replace($m.find, $m.repl))
  Write-Host "MUTATION: $($m.n)"
  $out = & node (Join-Path $PSScriptRoot 'run-suite.js') 2>&1 | Select-String '^FAIL' -CaseSensitive
  if ($out) { $out | ForEach-Object { Write-Host "    caught: $($_.Line.Trim())" } }
  else { Write-Host '    *** NO TEST FAILED -- the suite misses this ***'; $failed++ }
}
[IO.File]::WriteAllText($p, $orig)

# The patch layer: break the value path and confirm RENDER-1 catches it.
if ($patchOrig.Contains('renderPreviewPatch(container, record);')) {
  [IO.File]::WriteAllText($patch, $patchOrig.Replace('renderPreviewPatch(container, record);', 'void container;'))
  Write-Host 'MUTATION: patch layer stops writing values'
  $out = & node (Join-Path $PSScriptRoot 'run-suite.js') 2>&1 | Select-String '^FAIL' -CaseSensitive
  if ($out) { $out | ForEach-Object { Write-Host "    caught: $($_.Line.Trim())" } }
  else { Write-Host '    *** NO TEST FAILED -- the suite misses this ***'; $failed++ }
  [IO.File]::WriteAllText($patch, $patchOrig)
}

Write-Host ''
Write-Host "mutations missed: $failed (expected 0)"


