@echo off
chcp 65001 >nul
echo Testing DOCX Download
curl -I "https://flk.npc.gov.cn/law-search/download/pc?format=docx&bbbs=ff8081819c230fa1019c4551f8c8511b" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" -H "Referer: https://flk.npc.gov.cn/detail" > result.txt 2>&1
echo Result saved to result.txt
type result.txt
