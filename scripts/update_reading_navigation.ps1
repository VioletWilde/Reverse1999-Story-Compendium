$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$readableRoot = Join-Path $repositoryRoot 'readable'
$startMarker = '<!-- reading-navigation:start -->'
$endMarker = '<!-- reading-navigation:end -->'

$labels = @{
    'story_zh_CN_chapter_edition' = @{ Previous = '上一篇'; Index = '返回目录'; Next = '下一篇' }
    'story_zh_TW_chapter_edition' = @{ Previous = '上一篇'; Index = '返回目錄'; Next = '下一篇' }
    'story_en_chapter_edition'    = @{ Previous = 'Previous'; Index = 'Story index'; Next = 'Next' }
    'story_ja_chapter_edition'    = @{ Previous = '前へ'; Index = '目次へ戻る'; Next = '次へ' }
    'story_ko_chapter_edition'    = @{ Previous = '이전'; Index = '목차로'; Next = '다음' }
}

function Get-DocumentTitle([System.IO.FileInfo]$file) {
    $firstHeading = Get-Content -LiteralPath $file.FullName -Encoding utf8 |
        Where-Object { $_ -match '^#\s+(.+)$' } |
        Select-Object -First 1
    if ($firstHeading -match '^#\s+(.+)$') { return $Matches[1].Trim() }
    return $file.BaseName
}

function New-Navigation([System.IO.FileInfo]$previous, [System.IO.FileInfo]$next, [hashtable]$text) {
    $items = [System.Collections.Generic.List[string]]::new()
    if ($null -ne $previous) {
        $previousTitle = Get-DocumentTitle $previous
        $items.Add("[← $($text.Previous)：$previousTitle]($( [uri]::EscapeDataString($previous.Name) ))")
    }
    $items.Add("[$($text.Index)](../README.md)")
    if ($null -ne $next) {
        $nextTitle = Get-DocumentTitle $next
        $items.Add("[$($text.Next)：$nextTitle →]($( [uri]::EscapeDataString($next.Name) ))")
    }
    return "$startMarker`n$($items -join ' · ')`n$endMarker"
}

function ConvertTo-EncodedRelativeTarget([string]$target) {
    if ($target -match '^(?:https?://|mailto:|#)') { return $target }

    $fragment = ''
    $fragmentAt = $target.IndexOf('#')
    if ($fragmentAt -ge 0) {
        $fragment = $target.Substring($fragmentAt)
        $target = $target.Substring(0, $fragmentAt)
    }

    # Decode first so rerunning the script never double-encodes an existing %20.
    $decoded = [uri]::UnescapeDataString($target)
    # Unicode filenames are readable and supported by GitHub. Only encode spaces,
    # which otherwise terminate a bare Markdown link destination during parsing.
    return $decoded.Replace(' ', '%20') + $fragment
}

foreach ($edition in Get-ChildItem -LiteralPath $readableRoot -Directory) {
    if (-not $labels.ContainsKey($edition.Name)) { continue }
    foreach ($category in Get-ChildItem -LiteralPath $edition.FullName -Directory) {
        # All generated reading files begin with a numeric story/chapter ID. Sorting
        # that ID as a number preserves the same order readers see in each index
        # (for example, 38101 comes before 305101).
        $documents = @(Get-ChildItem -LiteralPath $category.FullName -File -Filter '*.md' | Sort-Object {
            if ($_.BaseName -match '^(\d+)') { [int64]$Matches[1] } else { [int64]::MaxValue }
        }, Name)
        for ($index = 0; $index -lt $documents.Count; $index++) {
            $file = $documents[$index]
            $previous = if ($index -gt 0) { $documents[$index - 1] } else { $null }
            $next = if ($index -lt $documents.Count - 1) { $documents[$index + 1] } else { $null }
            $navigation = New-Navigation $previous $next $labels[$edition.Name]
            $content = Get-Content -LiteralPath $file.FullName -Raw -Encoding utf8
            $pattern = "(?ms)\r?\n?$([regex]::Escape($startMarker)).*?$([regex]::Escape($endMarker))\r?\n?"
            $content = [regex]::Replace($content, $pattern, "`n")
            # Remove the divider that belongs to a previously generated footer.
            # This makes the script safe to run again after future story exports.
            $content = [regex]::Replace($content.TrimEnd(), '(?s)(?:\r?\n---[ \t]*(?:\r?\n)*)+\z', '')
            $headingMatch = [regex]::Match($content, '(?m)^#\s+.+$')
            if (-not $headingMatch.Success) { continue }
            $insertAt = $headingMatch.Index + $headingMatch.Length
            $headingAndPrefix = $content.Substring(0, $insertAt)
            $body = $content.Substring($insertAt).TrimStart([char[]]"`r`n")
            $content = "$headingAndPrefix`n`n$navigation`n`n$body"
            $content = $content.TrimEnd() + "`n`n---`n`n$navigation`n"
            $written = $false
            for ($attempt = 1; $attempt -le 5 -and -not $written; $attempt++) {
                try {
                    Set-Content -LiteralPath $file.FullName -Value $content -Encoding utf8 -NoNewline
                    $written = $true
                }
                catch [System.IO.IOException] {
                    if ($attempt -eq 5) { throw }
                    Start-Sleep -Milliseconds (100 * $attempt)
                }
            }
        }
    }

    # GitHub does not reliably parse bare spaces inside Markdown link targets.
    # Encode every local index target while leaving web links and anchors alone.
    $indexPath = Join-Path $edition.FullName 'README.md'
    if (Test-Path -LiteralPath $indexPath) {
        $indexContent = Get-Content -LiteralPath $indexPath -Raw -Encoding utf8
        $encodedIndex = [regex]::Replace(
            $indexContent,
            '(?<=\]\()([^)\r\n]+)(?=\))',
            { param($match) ConvertTo-EncodedRelativeTarget $match.Value }
        )
        if ($encodedIndex -ne $indexContent) {
            Set-Content -LiteralPath $indexPath -Value $encodedIndex -Encoding utf8 -NoNewline
        }
    }
}

Write-Output 'Reading navigation updated.'
