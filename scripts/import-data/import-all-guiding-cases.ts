/**
 * 导入全量最高法指导性案例（267条，第1-47批）
 *
 * 数据源：C:/Users/deloo/Downloads/guiding-cases (1)/guiding-cases/guiding_cases_final_v3.json
 * 格式：relevant_laws 为单字符串，如：
 *   "《中华人民共和国刑法》第三百八十五条第一款"
 *   "1.《中华人民共和国合同法》第一百零七条\n2.《中华人民共和国公司法》第二十条"
 *   "《中华人民共和国民法典》第188条"（混合阿拉伯/中文数字）
 *
 * 导入策略：
 *   - 先清除旧的 SUPREME_GUIDING 记录，再全量重写（保证幂等）
 *   - courtLevel: SUPREME，jurisdiction: 全国，applicabilitySignal: 0.95
 *   - 完成后触发全量认识论状态重计算
 *
 * 运行：
 *   npx ts-node --project scripts/tsconfig.json scripts/import-data/import-all-guiding-cases.ts
 */

import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';

// eslint-disable-next-line no-console
const log = (msg: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);

const prisma = new PrismaClient();

// ── 数字转换（阿拉伯 → 中文）─────────────────────────────────────────
const CN = ['零','一','二','三','四','五','六','七','八','九'];

function arabicToChinese(n: number): string {
  if (n < 10) return CN[n];
  if (n < 20) return '十' + (n % 10 > 0 ? CN[n % 10] : '');
  if (n < 100) { const t=Math.floor(n/10),o=n%10; return CN[t]+'十'+(o>0?CN[o]:''); }
  if (n < 1000) {
    const h=Math.floor(n/100),r=n%100;
    const base=CN[h]+'百';
    if (r===0) return base;
    if (r<10) return base+'零'+CN[r];
    const t=Math.floor(r/10),o=r%10;
    return base+CN[t]+'十'+(o>0?CN[o]:'');
  }
  // 千位（民法典最多到第1260条）
  const th=Math.floor(n/1000),r=n%1000;
  const base=CN[th]+'千';
  if (r===0) return base;
  if (r<10) return base+'零'+CN[r];
  if (r<100) { const t=Math.floor(r/10),o=r%10; return base+'零'+CN[t]+'十'+(o>0?CN[o]:''); }
  const h=Math.floor(r/100),r2=r%100;
  const mid=CN[h]+'百';
  if (r2===0) return base+mid;
  if (r2<10) return base+mid+'零'+CN[r2];
  const t=Math.floor(r2/10),o=r2%10;
  return base+mid+CN[t]+'十'+(o>0?CN[o]:'');
}

/** 统一条号为中文格式："第188条" → "第一百八十八条"，"第三百条" → 不变 */
function normalizeArticleNumber(raw: string): string {
  // 阿拉伯数字格式
  const arabicMatch = raw.match(/^第(\d+)条$/);
  if (arabicMatch) return `第${arabicToChinese(parseInt(arabicMatch[1], 10))}条`;
  // 已是中文格式
  if (/^第[一二三四五六七八九十百千零]+条$/.test(raw)) return raw;
  return raw;
}

// ── relevant_laws 解析（单字符串格式）────────────────────────────────
// 格式示例：
//   "《中华人民共和国刑法》第三百八十五条第一款"
//   "1.《合同法》第107条\n2.《公司法》第20条"
//   "《中华人民共和国民事诉讼法》204条"（阿拉伯数字无"第"前缀）
//   多法律之间用换行/序号分隔

interface ArticleRef { lawName: string; articleNumber: string; }

// 主正则：《法律名》第N条（中文或阿拉伯）
const LAW_ARTICLE_RE = /《([^》]+)》[^第]*?((?:第(?:\d+|[一二三四五六七八九十百千零]+)条[^，。；\n《]*?)+)/g;
const ARTICLE_NUM_RE = /第(?:(\d+)|([一二三四五六七八九十百千零]+))条/g;
// 补丁正则：《法律名》N条（阿拉伯数字直接跟"条"，缺少"第"，如"204条"）
const LAW_ARTICLE_BARE_RE = /《([^》]+)》\s*(\d+)\s*条/g;

// 法律名规范化：去掉括注、前缀序号
const NOISE_PREFIXES = /^[\d\s\.、。]+/;
function normalizeLawName(name: string): string {
  return name
    .replace(/（[^）]*）/g, '')   // 去括号注释
    .replace(/\([^)]*\)/g, '')
    .trim();
}

function parseRelevantLaws(text: string | null | undefined): ArticleRef[] {
  if (!text || text.trim().length === 0) return [];

  const result: ArticleRef[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  // 主正则：处理"第N条"格式（含"第"前缀）
  LAW_ARTICLE_RE.lastIndex = 0;
  while ((match = LAW_ARTICLE_RE.exec(text)) !== null) {
    const lawName = normalizeLawName(match[1]);
    const articlesPart = match[2];

    ARTICLE_NUM_RE.lastIndex = 0;
    let artMatch: RegExpExecArray | null;
    while ((artMatch = ARTICLE_NUM_RE.exec(articlesPart)) !== null) {
      const raw = artMatch[0].match(/^第\S+条/)?.[0] ?? artMatch[0];
      const articleNumber = normalizeArticleNumber(raw.match(/^(第[^第]+条)/)?.[1] ?? raw);
      const key = `${lawName}::${articleNumber}`;
      if (!seen.has(key) && articleNumber.startsWith('第')) {
        seen.add(key);
        result.push({ lawName, articleNumber });
      }
    }
  }

  // 补丁正则：处理"《法律》N条"（阿拉伯数字直接跟"条"，缺少"第"前缀，如"204条"）
  LAW_ARTICLE_BARE_RE.lastIndex = 0;
  while ((match = LAW_ARTICLE_BARE_RE.exec(text)) !== null) {
    const lawName = normalizeLawName(match[1]);
    const n = parseInt(match[2], 10);
    const articleNumber = `第${arabicToChinese(n)}条`;
    const key = `${lawName}::${articleNumber}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ lawName, articleNumber });
    }
  }

  return result;
}

// ── 废止→现行映射表 ──────────────────────────────────────────────────
interface RepealedMapping {
  fromLaw: string;
  aliases: string[];
  toLaw: string;
  articles: Array<{ from: string; to: string | null; note: string }>;
}
interface MappingFile { mappings: RepealedMapping[] }

/** key: "废止法律名（含变体）::废止条号" → "民法典条号" */
function buildRepealedIndex(index: Map<string, string>): Map<string, string> {
  const mappingPath = require('path').join(__dirname, '..', 'data', 'repealed-law-mapping.json');

  if (!fs.existsSync(mappingPath)) {
    log(`⚠ 废止映射文件不存在：${mappingPath}，跳过废止回退`);
    return new Map();
  }

  const file = JSON.parse(fs.readFileSync(mappingPath, 'utf-8')) as MappingFile;
  const repMap = new Map<string, string>();

  for (const group of file.mappings) {
    const allFromNames = [group.fromLaw, ...group.aliases];
    for (const art of group.articles) {
      if (!art.to) continue; // null 表示无对应民法典条文，跳过
      const toId = index.get(`${group.toLaw}::${art.to}`)
        ?? index.get(`${group.toLaw.replace(/^中华人民共和国/, '')}::${art.to}`);
      if (!toId) continue; // 目标条文不在DB，无法映射

      for (const fromName of allFromNames) {
        const key = `${fromName}::${art.from}`;
        if (!repMap.has(key)) repMap.set(key, toId);
        // 也建短名版本
        const short = fromName.replace(/^中华人民共和国/, '');
        const shortKey = `${short}::${art.from}`;
        if (!repMap.has(shortKey)) repMap.set(shortKey, toId);
      }
    }
  }
  log(`废止法律映射：${repMap.size / 2} 条对应关系已加载`);
  return repMap;
}

// ── 法条数据库索引 ────────────────────────────────────────────────────
async function buildIndex(): Promise<Map<string, string>> {
  const articles = await prisma.lawArticle.findMany({
    where: { status: { in: ['VALID', 'AMENDED'] } },
    select: { id: true, lawName: true, articleNumber: true, status: true, effectiveDate: true },
    orderBy: [{ status: 'asc' }, { effectiveDate: 'desc' }], // VALID 排前面
  });

  const map = new Map<string, string>();
  for (const a of articles) {
    const key = `${a.lawName}::${a.articleNumber}`;
    if (!map.has(key)) map.set(key, a.id); // 只取第一条（VALID优先）
  }
  log(`法条索引：${map.size} 条（${new Set(articles.map(a=>a.lawName)).size} 部法律）`);
  return map;
}

function lookupId(
  lawName: string,
  articleNumber: string,
  index: Map<string, string>,
  repealedIndex: Map<string, string>,
): { id: string; isMapped: boolean } | null {
  // 1. 精确匹配（现行法律直接命中）
  const k1 = index.get(`${lawName}::${articleNumber}`);
  if (k1) return { id: k1, isMapped: false };
  // 2. 加/去"中华人民共和国"前缀
  const k2 = index.get(`中华人民共和国${lawName}::${articleNumber}`);
  if (k2) return { id: k2, isMapped: false };
  const short = lawName.replace(/^中华人民共和国/, '');
  const k3 = index.get(`${short}::${articleNumber}`);
  if (k3) return { id: k3, isMapped: false };
  // 3. 后缀模糊匹配（法律名最后6-10字）
  for (const suffix of [6, 8, 10]) {
    const tail = lawName.slice(-suffix);
    for (const [key, id] of index) {
      if (key.endsWith(`::${articleNumber}`) && key.includes(tail)) return { id, isMapped: false };
    }
  }
  // 4. 废止法律 → 民法典 回退映射
  const rk1 = repealedIndex.get(`${lawName}::${articleNumber}`);
  if (rk1) return { id: rk1, isMapped: true };
  const rk2 = repealedIndex.get(`${short}::${articleNumber}`);
  if (rk2) return { id: rk2, isMapped: true };
  return null;
}

// ── 认识论状态计算（内联，避免@/路径问题）────────────────────────────
async function recompute(articleIds: string[]): Promise<void> {
  const CW: Record<string,number> = { SUPREME:2.5, JUDICIAL_INTERP:2.8, HIGH:1.8, INTERMEDIATE:1.2, BASIC:0.8, UNKNOWN:1.0 };
  const PROVINCES = ['北京','天津','上海','重庆','河北','山西','辽宁','吉林','黑龙江','江苏','浙江','安徽','福建','江西','山东','河南','湖北','湖南','广东','海南','四川','贵州','云南','陕西','甘肃','青海','内蒙古','广西','西藏','宁夏','新疆'];
  const SUPPORT_RE = [/依据.{0,20}(认定|支持)/, /符合.{0,15}规定/, /适用.{0,10}(本条|该条)/, /应予(支持|认可)/];
  const REBUTTAL_RULES = [
    { w:0.85, re:[/不(适用|符合|满足|成立|构成)/, /已(废止|失效|撤销)/, /驳回/] },
    { w:0.5,  re:[/仅(适用|限于)/, /除非|前提是/] },
    { w:0.65, re:[/特别法|优先(于|适用)/, /竞合|冲突/] },
    { w:0.25, re:[/难以(认定|支持)/, /尚(存争议|无定论)/] },
  ];
  const detectLv = (c:string|null|undefined) => {
    if(!c) return 'UNKNOWN';
    if(c.includes('最高')) return 'SUPREME';
    if(c.includes('高级')||c.includes('高院')) return 'HIGH';
    if(c.includes('中级')||c.includes('中院')) return 'INTERMEDIATE';
    return 'BASIC';
  };
  const detectJu = (c:string|null|undefined) => {
    if(!c) return 'UNKNOWN';
    for(const p of PROVINCES){if(c.includes(p))return p;}
    return 'UNKNOWN';
  };
  const indep = (srcs:{level:string;jurisdiction:string}[]) => {
    if(!srcs.length) return {independence:0,effectiveCount:0,jurisdictionCount:0,courtLevelSpread:0};
    const cls=new Map<string,number>();
    for(const s of srcs){const k=`${s.jurisdiction}::${s.level}`;cls.set(k,(cls.get(k)??0)+1);}
    let eff=0; for(const[,sz]of cls) eff+=1/Math.sqrt(Math.max(1,sz));
    return {
      independence:Math.min(1,eff/srcs.length),
      effectiveCount:Math.round(eff*100)/100,
      jurisdictionCount:new Set(srcs.map(s=>s.jurisdiction).filter(j=>j!=='UNKNOWN')).size,
      courtLevelSpread:new Set(srcs.map(s=>s.level).filter(l=>l!=='UNKNOWN')).size,
    };
  };
  const profile = (consensus:number,rebuttal:number,inertia:number,inPool:boolean,hasAmended:boolean) => {
    let guide: string;
    let prof: 'IRON_CLAD'|'MAINSTREAM_TROUBLED'|'CANDIDATE_POOL'|'FADING'|'UNCERTAIN';
    if(consensus>0.85&&rebuttal<0.15){prof='IRON_CLAD';guide='可以确定地说';}
    else if(consensus>0.65&&rebuttal>0.20){prof='MAINSTREAM_TROUBLED';guide='目前仍倾向于认为';}
    else if(inPool&&consensus>0.35&&consensus<=0.65){prof='CANDIDATE_POOL';guide='目前无法确定';}
    else if(rebuttal>0.70||consensus<0.35){prof='FADING';guide='现在倾向于认为这一解释存在争议';}
    else{prof='UNCERTAIN';guide='目前没有足够案例数据来判断法院在类似情形下是否一致适用该条文，但本案所涉事实较适用该条文，具体适用须以法院裁量为准';}
    if(hasAmended) guide+=`（注：该条文存在修正案历史版本，引用历史案例时须核查当时适用版本与现行条文的差异）`;
    return {profile:prof,expressionGuide:guide};
  };

  const ALPHA=0.20,DECAY=0.78,PE=0.40,PX=0.15;
  let done=0;
  for(const articleId of articleIds){
    const cur=await prisma.lawArticle.findUnique({where:{id:articleId},select:{lawName:true,articleNumber:true}});
    const allIds=cur
      ? await prisma.lawArticle.findMany({where:{lawName:cur.lawName,articleNumber:cur.articleNumber},select:{id:true}}).then(r=>r.map(x=>x.id))
      : [articleId];
    const hasAmended=allIds.length>1&&await prisma.lawArticle.count({where:{id:{in:allIds},status:'AMENDED'}}).then(c=>c>0);

    const [refs,hists]=await Promise.all([
      prisma.legalReference.findMany({
        where:{articleId,status:'VALID',NOT:{metadata:{path:['aiGenerated'],equals:true}}},
        include:{case:{select:{id:true,court:true,createdAt:true}}},
        orderBy:{createdAt:'asc'},
      }),
      prisma.historicalCaseArticleRef.findMany({where:{lawArticleId:{in:allIds}}}),
    ]);

    const ls=refs.map(r=>({level:detectLv(r.case?.court),jurisdiction:detectJu(r.case?.court)}));
    const hs=hists.map(r=>({level:r.courtLevel,jurisdiction:r.jurisdiction}));
    const ind=indep([...ls,...hs]);

    let cs=0.5,rb=0.01,in_=0.0,ip=false;
    let ped:Date|undefined,pxd:Date|undefined,alt=0.0,min=0,lid:string|undefined;
    for(let i=0;i<refs.length;i++){
      const ref=refs[i];
      const lw=CW[ls[i].level]??1.0;
      const w=Math.min(2,lw*ind.independence);
      const alpha=ALPHA*w;
      let maxStr=0,isR=false,isS=false,isC=false;
      for(const rule of REBUTTAL_RULES){if(rule.re.some(p=>p.test(ref.content))&&rule.w>maxStr){maxStr=rule.w;isR=true;}}
      isS=SUPPORT_RE.some(p=>p.test(ref.content));
      isC=REBUTTAL_RULES[2].re.some(p=>p.test(ref.content));
      if(maxStr>0.3&&cs>0.75)min++;
      if(isS&&!isR)cs=Math.min(0.98,cs+alpha*0.3);
      if(isR){rb=Math.min(1,rb+alpha*maxStr);cs=Math.max(0,cs-alpha*0.7*maxStr);}
      if(isC)alt=Math.min(1,alt+alpha*0.8);
      in_=maxStr*w+DECAY*in_;
      const prev=ip;
      if(in_>PE&&!ip){ip=true;ped=ref.case?.createdAt;}
      else if(in_<PX&&ip){ip=false;pxd=ref.case?.createdAt;}
      if(!prev&&ip)ped=ref.case?.createdAt;
      lid=ref.caseId??undefined;
    }
    for(const h of hists){
      const lw=CW[h.courtLevel]??1.0;
      const sat=Math.min(2,Math.log10(1+h.caseCount));
      cs=Math.min(0.98,cs+ALPHA*lw*0.5*h.applicabilitySignal*sat*0.1);
    }
    const {profile:prof,expressionGuide:eg}=profile(cs,rb,in_,ip,hasAmended);
    const tot=refs.length+hists.reduce((s,r)=>s+r.caseCount,0);
    const d={profile:prof,consensusScore:Math.round(cs*1000)/1000,challengePressure:Math.round(rb*1000)/1000,
      inertia:Math.round(in_*1000)/1000,inCandidatePool:ip,alternativeStrength:Math.round(alt*1000)/1000,
      sourceIndependence:Math.round(ind.independence*1000)/1000,effectiveSourceCount:ind.effectiveCount,
      totalCasesApplied:tot,jurisdictionCount:ind.jurisdictionCount,courtLevelSpread:ind.courtLevelSpread,
      minorityPressureCount:min,poolEntryDate:ped,poolExitDate:pxd,expressionGuide:eg,lastCaseId:lid??null};
    await prisma.lawArticleEpistemicState.upsert({
      where:{lawArticleId:articleId},create:{lawArticleId:articleId,...d},update:{...d,computedAt:new Date()},
    });
    done++;
  }
  log(`认识论重计算：${done} 条法条`);
}

// ── 主流程 ────────────────────────────────────────────────────────────
async function main() {
  const dataPath = 'C:/Users/deloo/Downloads/guiding-cases (1)/guiding-cases/guiding_cases_final_v3.json';
  if (!fs.existsSync(dataPath)) { log(`文件不存在：${dataPath}`); process.exit(1); }

  const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf-8')) as {
    metadata: { total_cases: number };
    cases: Array<{ case_no: number|string; title: string; batch: number; publish_date: string; relevant_laws: string | string[] | null; }>;
  };

  const cases = rawData.cases;
  log(`=== 全量指导案例导入（${cases.length}条，第1-47批）===`);

  // 加载案例覆盖表
  const overridesPath = require('path').join(__dirname, '..', 'data', 'case-overrides.json');
  const overrides: Record<string, { reason: string; articles: string[] }> = fs.existsSync(overridesPath)
    ? (JSON.parse(fs.readFileSync(overridesPath, 'utf-8')) as { overrides: Record<string, { reason: string; articles: string[] }> }).overrides
    : {};
  log(`案例覆盖表：${Object.keys(overrides).length} 条`);

  log('\n加载法条索引...');
  const index = await buildIndex();
  const repealedIndex = buildRepealedIndex(index);

  // 先清除旧数据（保证幂等）
  const cleared = await prisma.historicalCaseArticleRef.deleteMany({ where: { dataSource: 'SUPREME_GUIDING' } });
  log(`已清除旧 SUPREME_GUIDING 记录：${cleared.count} 条`);

  log('\n开始解析并写入...');
  let written=0, noMatch=0, noLaw=0;
  const affectedIds = new Set<string>();

  for (const c of cases) {
    const caseNo = `指导案例${c.case_no}号`;

    // 案例覆盖表优先（处理数据质量问题，无需重新采集）
    const caseKey = String(c.case_no);
    const overrideEntry = overrides[caseKey];

    // relevant_laws 可能是字符串或字符串数组（批次不同格式有差异）
    const rawLaws = overrideEntry
      ? overrideEntry.articles.join('\n')
      : Array.isArray(c.relevant_laws)
        ? c.relevant_laws.join('\n')
        : (c.relevant_laws ?? '');
    if (!rawLaws || rawLaws.trim().length === 0) {
      noLaw++;
      continue;
    }

    const refs = parseRelevantLaws(rawLaws);
    if (refs.length === 0) {
      log(`  ⚠ ${caseNo}「${c.title?.slice(0,20)}」— 解析无法条`);
      noMatch++;
      continue;
    }

    const matchedIds: string[] = [];
    const unmatched: string[] = [];
    const mappedNotes: string[] = [];

    for (const ref of refs) {
      const result = lookupId(ref.lawName, ref.articleNumber, index, repealedIndex);
      if (result) {
        matchedIds.push(result.id);
        affectedIds.add(result.id);
        if (result.isMapped) {
          mappedNotes.push(`${ref.lawName.replace(/^中华人民共和国/, '')}${ref.articleNumber}→民法典`);
        }
      } else {
        unmatched.push(`${ref.lawName.slice(-6)}${ref.articleNumber}`);
      }
    }

    if (matchedIds.length === 0) {
      log(`  ⚠ ${caseNo}「${c.title?.slice(0,20)}」— DB无匹配 [${unmatched.join('|')}]`);
      noMatch++;
      continue;
    }

    for (const articleId of matchedIds) {
      await prisma.historicalCaseArticleRef.upsert({
        where: { lawArticleId_jurisdiction_courtLevel: { lawArticleId: articleId, jurisdiction: '全国', courtLevel: 'SUPREME' } },
        update: { caseCount: { increment: 1 }, applicabilitySignal: 0.95, dataSource: 'SUPREME_GUIDING', updatedAt: new Date() },
        create: { lawArticleId: articleId, dataSource: 'SUPREME_GUIDING', jurisdiction: '全国', courtLevel: 'SUPREME', caseCount: 1, applicabilitySignal: 0.95 },
      });
      written++;
    }

    const unmatchedNote = unmatched.length > 0 ? ` [未匹配:${unmatched.join(',')}]` : '';
    const mappedNote = mappedNotes.length > 0 ? ` [废止映射:${mappedNotes.join(',')}]` : '';
    log(`  ✓ ${caseNo} 第${c.batch}批「${c.title?.slice(0,22)}」→ ${matchedIds.length}条${mappedNote}${unmatchedNote}`);
  }

  log(`\n写入完成：${written} 条，无法条案例：${noLaw}，无匹配案例：${noMatch}`);

  const total = await prisma.historicalCaseArticleRef.count({ where: { dataSource: 'SUPREME_GUIDING' } });
  log(`SUPREME_GUIDING 总记录：${total}，覆盖法条：${affectedIds.size} 条`);

  log('\n触发全量认识论重计算...');
  // 合并所有已有历史引用的法条
  const allAffected = await prisma.historicalCaseArticleRef.findMany({
    select: { lawArticleId: true }, distinct: ['lawArticleId'],
  });
  const allIds = [...new Set([...affectedIds, ...allAffected.map(r => r.lawArticleId)])];
  await recompute(allIds);

  const dist = await prisma.lawArticleEpistemicState.groupBy({ by: ['profile'], _count: { id: true } });
  log('\n最终认识论状态分布：');
  dist.forEach(d => log(`  ${d.profile}: ${d._count.id} 条`));
}

main().catch(err => { log(`FATAL: ${err}`); process.exit(1); }).finally(() => prisma.$disconnect());
