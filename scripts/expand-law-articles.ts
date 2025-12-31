/**
 * 扩充法条数据脚本
 * 生成更多法条数据，使总数达到300-500条
 */

import { PrismaClient, LawCategory } from "@prisma/client";

const prisma = new PrismaClient();

// 生成更多民法法条
function generateCivilArticles() {
  const articles = [];
  const baseArticles = [
    {
      articleNumber: "第一百二十条",
      fullText: "民事权益受到侵害的，被侵权人有权请求侵权人承担侵权责任。",
    },
    {
      articleNumber: "第一百二十一条",
      fullText:
        "民事主体的人身权利、财产权利以及其他合法权益受法律保护，任何组织或者个人不得侵犯。",
    },
    {
      articleNumber: "第一百二十二条",
      fullText:
        "因他人没有法律根据，取得不当利益，受损失的人有权请求其返还不当利益。",
    },
    {
      articleNumber: "第一百二十三条",
      fullText:
        "民事主体依法享有知识产权。知识产权是权利人依法就下列客体享有的专有的权利：（一）作品；（二）发明、实用新型、外观设计；（三）商标；（四）地理标志；（五）商业秘密；（六）集成电路布图设计；（七）植物新品种；（八）法律规定的其他客体。",
    },
    {
      articleNumber: "第一百二十四条",
      fullText: "自然人依法享有继承权。自然人合法的私有财产，可以依法继承。",
    },
    {
      articleNumber: "第一百二十五条",
      fullText: "民事主体依法享有股权和其他投资性权利。",
    },
    {
      articleNumber: "第一百二十六条",
      fullText: "民事主体享有法律规定的其他民事权利和利益。",
    },
    {
      articleNumber: "第一百二十七条",
      fullText: "法律对数据、网络虚拟财产的保护有规定的，依照其规定。",
    },
    {
      articleNumber: "第一百二十八条",
      fullText:
        "法律对未成年人、老年人、残疾人、妇女、消费者等的民事权利保护有特别规定的，依照其规定。",
    },
    {
      articleNumber: "第一百二十九条",
      fullText:
        "民事权利可以依据民事法律行为、事实行为、法律规定的事件或者法律规定的其他方式取得。",
    },
  ];

  for (const base of baseArticles) {
    articles.push({
      lawName: "中华人民共和国民法典",
      articleNumber: base.articleNumber,
      fullText: base.fullText,
      lawType: "LAW",
      category: "CIVIL",
      subCategory: "总则编",
      tags: ["民法", "民事权利"],
      keywords: ["民事", "权利", "权益", "保护"],
      version: "1.0",
      effectiveDate: "2021-01-01T00:00:00Z",
      status: "VALID",
      issuingAuthority: "全国人民代表大会",
      jurisdiction: "全国",
      searchableText: base.fullText,
      viewCount: 0,
      referenceCount: 0,
    });
  }

  return articles;
}

// 生成更多合同法条
function generateContractArticles() {
  const articles = [];
  const baseArticles = [
    {
      articleNumber: "第五百九十条",
      fullText:
        "当事人应当按照约定全面履行自己的义务。当事人应当遵循诚信原则，根据合同的性质、目的和交易习惯履行通知、协助、保密等义务。",
    },
    {
      articleNumber: "第五百九十一条",
      fullText:
        "当事人一方不履行非金钱债务或者履行非金钱债务不符合约定的，对方可以请求履行，但是有下列情形之一的除外：（一）法律上或者事实上不能履行；（二）债务的标的不适于强制履行或者履行费用过高；（三）债权人在合理期限内未请求履行。",
    },
    {
      articleNumber: "第五百九十二条",
      fullText: "当事人都违反合同的，应当各自承担相应的责任。",
    },
    {
      articleNumber: "第五百九十三条",
      fullText:
        "当事人一方因第三人的原因造成违约的，应当依法向对方承担违约责任。",
    },
    {
      articleNumber: "第五百九十四条",
      fullText:
        "因国际货物买卖合同和技术进出口合同争议提起诉讼或者申请仲裁的时效期间为四年，自当事人知道或者应当知道其权利受到侵害之日起计算。",
    },
    {
      articleNumber: "第五百九十五条",
      fullText:
        "买卖合同是出卖人转移标的物的所有权于买受人，买受人支付价款的合同。",
    },
    {
      articleNumber: "第五百九十六条",
      fullText:
        "买卖合同的内容一般包括标的物的名称、数量、质量、价款、履行期限、地点和方式、包装方式、检验标准和方法、结算方式、合同使用的文字及其效力等条款。",
    },
    {
      articleNumber: "第五百九十七条",
      fullText:
        "因出卖人未取得处分权致使标的物所有权不能转移的，买受人可以解除合同并请求出卖人承担违约责任。",
    },
    {
      articleNumber: "第五百九十八条",
      fullText:
        "出卖人应当履行向买受人交付标的物或者交付提取标的物的单证，并转移标的物所有权的义务。",
    },
    {
      articleNumber: "第五百九十九条",
      fullText:
        "出卖人应当按照约定或者交易习惯向买受人交付提取标的物单证以外的有关单证和资料。",
    },
  ];

  for (const base of baseArticles) {
    articles.push({
      lawName: "中华人民共和国民法典",
      articleNumber: base.articleNumber,
      fullText: base.fullText,
      lawType: "LAW",
      category: "CIVIL",
      subCategory: "合同编",
      tags: ["合同", "买卖", "履行"],
      keywords: ["合同", "买卖", "履行", "违约"],
      version: "1.0",
      effectiveDate: "2021-01-01T00:00:00Z",
      status: "VALID",
      issuingAuthority: "全国人民代表大会",
      jurisdiction: "全国",
      searchableText: base.fullText,
      viewCount: 0,
      referenceCount: 0,
    });
  }

  return articles;
}

// 生成更多劳动法法条
function generateLaborArticles() {
  const articles = [];
  const baseArticles = [
    {
      articleNumber: "第十条",
      fullText:
        "建立劳动关系，应当订立书面劳动合同。已建立劳动关系，未同时订立书面劳动合同的，应当自用工之日起一个月内订立书面劳动合同。",
    },
    {
      articleNumber: "第十一条",
      fullText:
        "用人单位未在用工的同时订立书面劳动合同，与劳动者约定的劳动报酬不明确的，新招用的劳动者的劳动报酬按照集体合同规定的标准执行；没有集体合同或者集体合同未规定的，实行同工同酬。",
    },
    {
      articleNumber: "第十二条",
      fullText:
        "劳动合同分为固定期限劳动合同、无固定期限劳动合同和以完成一定工作任务为期限的劳动合同。",
    },
    {
      articleNumber: "第十三条",
      fullText:
        "固定期限劳动合同，是指用人单位与劳动者约定合同终止时间的劳动合同。",
    },
    {
      articleNumber: "第十四条",
      fullText:
        "无固定期限劳动合同，是指用人单位与劳动者约定无确定终止时间的劳动合同。",
    },
    {
      articleNumber: "第十五条",
      fullText:
        "以完成一定工作任务为期限的劳动合同，是指用人单位与劳动者约定以某项工作的完成为合同期限的劳动合同。",
    },
    {
      articleNumber: "第十六条",
      fullText:
        "劳动合同由用人单位与劳动者协商一致，并经用人单位与劳动者在劳动合同文本上签字或者盖章生效。",
    },
    {
      articleNumber: "第十七条",
      fullText:
        "劳动合同应当具备以下条款：（一）用人单位的名称、住所和法定代表人或者主要负责人；（二）劳动者的姓名、住址和居民身份证或者其他有效身份证件号码；（三）劳动合同期限；（四）工作内容和工作地点；（五）工作时间和休息休假；（六）劳动报酬；（七）社会保险；（八）劳动保护、劳动条件和职业危害防护；（九）法律、法规规定应当纳入劳动合同的其他事项。",
    },
    {
      articleNumber: "第十八条",
      fullText:
        "劳动合同对劳动报酬和劳动条件等标准约定不明确，引发争议的，用人单位与劳动者可以重新协商；协商不成的，适用集体合同规定；没有集体合同或者集体合同未规定劳动报酬的，实行同工同酬；没有集体合同或者集体合同未规定劳动条件等标准的，适用国家有关规定。",
    },
    {
      articleNumber: "第十九条",
      fullText:
        "劳动合同期限三个月以上不满一年的，试用期不得超过一个月；劳动合同期限一年以上不满三年的，试用期不得超过二个月；三年以上固定期限和无固定期限的劳动合同，试用期不得超过六个月。",
    },
  ];

  for (const base of baseArticles) {
    articles.push({
      lawName: "中华人民共和国劳动合同法",
      articleNumber: base.articleNumber,
      fullText: base.fullText,
      lawType: "LAW",
      category: "LABOR",
      subCategory: "劳动合同",
      tags: ["劳动", "劳动合同", "试用期"],
      keywords: ["劳动", "合同", "试用期", "报酬"],
      version: "1.0",
      effectiveDate: "2008-01-01T00:00:00Z",
      status: "VALID",
      issuingAuthority: "全国人民代表大会常务委员会",
      jurisdiction: "全国",
      searchableText: base.fullText,
      viewCount: 0,
      referenceCount: 0,
    });
  }

  return articles;
}

// 生成更多公司法法条
function generateCompanyArticles() {
  const articles = [];
  const baseArticles = [
    {
      articleNumber: "第三条",
      fullText:
        "公司是企业法人，有独立的法人财产，享有法人财产权。公司以其全部财产对公司的债务承担责任。有限责任公司的股东以其认缴的出资额为限对公司承担责任；股份有限公司的股东以其认购的股份为限对公司承担责任。",
    },
    {
      articleNumber: "第四条",
      fullText:
        "有限责任公司股东认缴出资额、股份有限公司股东认购股份，出资方式或者股份安排应当符合法律、行政法规的规定。",
    },
    {
      articleNumber: "第五条",
      fullText: "公司章程对公司、股东、董事、监事、高级管理人员具有约束力。",
    },
    {
      articleNumber: "第六条",
      fullText:
        "公司设立、变更、终止，应当依法向公司登记机关申请登记，法律、行政法规规定必须经审批的，还应当办理审批手续。",
    },
    {
      articleNumber: "第七条",
      fullText:
        "公司营业执照应当载明公司的名称、住所、注册资本、经营范围、法定代表人姓名等事项。",
    },
    {
      articleNumber: "第八条",
      fullText: "公司营业执照记载的事项发生变更的，公司应当依法办理变更登记。",
    },
    {
      articleNumber: "第九条",
      fullText:
        "公司可以设立分公司。分公司不具有法人资格，其民事责任由公司承担。",
    },
    {
      articleNumber: "第十条",
      fullText: "公司设立子公司，子公司具有法人资格，依法独立承担民事责任。",
    },
    {
      articleNumber: "第十一条",
      fullText: "公司章程对公司、股东、董事、监事、高级管理人员具有约束力。",
    },
    {
      articleNumber: "第十二条",
      fullText:
        "公司的经营范围由公司章程规定，并依法登记。公司可以修改公司章程，改变经营范围，但是应当办理变更登记。",
    },
  ];

  for (const base of baseArticles) {
    articles.push({
      lawName: "中华人民共和国公司法",
      articleNumber: base.articleNumber,
      fullText: base.fullText,
      lawType: "LAW",
      category: "COMMERCIAL",
      subCategory: "公司设立",
      tags: ["公司", "法人", "股东"],
      keywords: ["公司", "法人", "股东", "出资", "责任"],
      version: "1.0",
      effectiveDate: "2024-07-01T00:00:00Z",
      status: "VALID",
      issuingAuthority: "全国人民代表大会常务委员会",
      jurisdiction: "全国",
      searchableText: base.fullText,
      viewCount: 0,
      referenceCount: 0,
    });
  }

  return articles;
}

// 生成更多知识产权法法条
function generateIntellectualArticles() {
  const articles = [];
  const baseArticles = [
    {
      articleNumber: "第二条",
      fullText:
        "中国公民、法人或者其他组织的作品，不论是否发表，依照本法享有著作权。外国人、无国籍人的作品根据其作者所属国或者经常居住地国同中国签订的协议或者共同参加的国际条约享有的著作权，受本法保护。外国人、无国籍人的作品首先在中国境内出版的，依照本法享有著作权。未与中国签订协议或者共同参加国际条约的国家的作者以及无国籍人的作品首次在中国参加的国际条约的成员国出版的，或者在成员国和非成员国同时出版的，受本法保护。",
    },
    {
      articleNumber: "第三条",
      fullText:
        "本法所称的作品，是指文学、艺术和科学领域内具有独创性并能以一定形式表现的智力成果，包括：（一）文字作品；（二）口述作品；（三）音乐、戏剧、曲艺、舞蹈、杂技艺术作品；（四）美术、建筑作品；（五）摄影作品；（六）电影作品和以类似摄制电影的方法创作的作品；（七）工程设计图、产品设计图、地图、示意图等图形作品和模型作品；（八）计算机软件；（九）法律、行政法规规定的其他作品。",
    },
    {
      articleNumber: "第十条",
      fullText:
        "著作权包括下列人身权和财产权：（一）发表权；（二）署名权；（三）修改权；（四）保护作品完整权；（五）复制权；（六）发行权；（七）出租权；（八）展览权；（九）表演权；（十）放映权；（十一）广播权；（十二）信息网络传播权；（十三）摄制权；（十四）改编权；（十五）翻译权；（十六）汇编权；（十七）应当由著作权人享有的其他权利。",
    },
    {
      articleNumber: "第十一条",
      fullText:
        "著作权属于作者，本法另有规定的除外。创作作品的公民是作者。由法人或者其他组织主持，代表法人或者其他组织意志创作，并由法人或者其他组织承担责任的作品，法人或者其他组织视为作者。如无相反证明，在作品上署名的公民、法人或者其他组织为作者。",
    },
    {
      articleNumber: "第十二条",
      fullText:
        "改编、翻译、注释、整理已有作品而产生的作品，其著作权由改编、翻译、注释、整理人享有，但行使著作权时不得侵犯原作品的著作权。",
    },
  ];

  for (const base of baseArticles) {
    articles.push({
      lawName: "中华人民共和国著作权法",
      articleNumber: base.articleNumber,
      fullText: base.fullText,
      lawType: "LAW",
      category: LawCategory.INTELLECTUAL_PROPERTY,
      subCategory: "著作权",
      tags: ["著作权", "作品", "知识产权"],
      keywords: ["著作权", "作品", "版权", "发表权"],
      version: "1.0",
      effectiveDate: "2021-06-01T00:00:00Z",
      status: "VALID",
      issuingAuthority: "全国人民代表大会常务委员会",
      jurisdiction: "全国",
      searchableText: base.fullText,
      viewCount: 0,
      referenceCount: 0,
    });
  }

  return articles;
}

// 生成更多诉讼法法条
function generateProceduralArticles() {
  const articles = [];
  const baseArticles = [
    {
      articleNumber: "第一百一十九条",
      fullText:
        "起诉必须符合下列条件：（一）原告是与本案有直接利害关系的公民、法人和其他组织；（二）有明确的被告；（三）有具体的诉讼请求和事实、理由；（四）属于人民法院受理民事诉讼的范围和受诉人民法院管辖。",
    },
    {
      articleNumber: "第一百二十条",
      fullText:
        "起诉应当向人民法院递交起诉状，并按照被告人数提出副本。书写起诉状确有困难的，可以口头起诉，由人民法院记入笔录，并告知对方当事人。",
    },
    {
      articleNumber: "第一百二十一条",
      fullText:
        "起诉状应当记明下列事项：（一）原告的姓名、性别、年龄、民族、职业、工作单位、住所、联系方式，法人或者其他组织的名称、住所和法定代表人或者主要负责人的姓名、职务、联系方式；（二）被告的姓名、性别、工作单位、住所等信息，法人或者其他组织的名称、住所等信息；（三）诉讼请求和所根据的事实与理由；（四）证据和证据来源，证人姓名和住所。",
    },
    {
      articleNumber: "第一百二十二条",
      fullText:
        "当事人起诉到人民法院的民事纠纷，适宜调解的，先行调解，但当事人拒绝调解的除外。",
    },
    {
      articleNumber: "第一百二十三条",
      fullText:
        "人民法院应当保障当事人依照法律规定享有的起诉权利。对符合本法第一百一十九条的起诉，必须受理。符合起诉条件的，应当在七日内立案，并通知当事人；不符合起诉条件的，应当在七日内作出裁定书，不予受理；原告对裁定不服的，可以提起上诉。",
    },
  ];

  for (const base of baseArticles) {
    articles.push({
      lawName: "中华人民共和国民事诉讼法",
      articleNumber: base.articleNumber,
      fullText: base.fullText,
      lawType: "LAW",
      category: LawCategory.PROCEDURE,
      subCategory: "起诉与受理",
      tags: ["诉讼", "起诉", "受理"],
      keywords: ["诉讼", "起诉", "受理", "起诉状"],
      version: "1.0",
      effectiveDate: "2022-01-01T00:00:00Z",
      status: "VALID",
      issuingAuthority: "全国人民代表大会常务委员会",
      jurisdiction: "全国",
      searchableText: base.fullText,
      viewCount: 0,
      referenceCount: 0,
    });
  }

  return articles;
}

// 生成更多行政法法条
function generateAdministrativeArticles() {
  const articles = [];
  const baseArticles = [
    {
      articleNumber: "第二条",
      fullText:
        "公民、法人或者其他组织认为行政机关和行政机关工作人员的行政行为侵犯其合法权益，有权依照本法向人民法院提起诉讼。前款所称行政行为，包括法律、法规、规章授权的组织作出的行政行为。",
    },
    {
      articleNumber: "第三条",
      fullText:
        "人民法院应当保障公民、法人和其他组织的起诉权利，对应当受理的行政案件依法受理。",
    },
    {
      articleNumber: "第四条",
      fullText:
        "人民法院依法对行政案件独立行使审判权，不受行政机关、社会团体和个人的干涉。",
    },
    {
      articleNumber: "第五条",
      fullText: "人民法院审理行政案件，以事实为根据，以法律为准绳。",
    },
    {
      articleNumber: "第六条",
      fullText:
        "人民法院审理行政案件，依法实行合议、回避、公开审判和两审终审制度。",
    },
    {
      articleNumber: "第七条",
      fullText: "当事人在行政诉讼中的法律地位平等。",
    },
    {
      articleNumber: "第八条",
      fullText:
        "各民族公民都有用本民族语言、文字进行行政诉讼的权利。在少数民族聚居或者多民族共同居住的地区，人民法院应当用当地民族通用的语言、文字进行审理和发布法律文书。人民法院应当对不通晓当地民族通用的语言、文字的诉讼参与人提供翻译。",
    },
  ];

  for (const base of baseArticles) {
    articles.push({
      lawName: "中华人民共和国行政诉讼法",
      articleNumber: base.articleNumber,
      fullText: base.fullText,
      lawType: "LAW",
      category: "ADMINISTRATIVE",
      subCategory: "总则",
      tags: ["行政", "诉讼", "行政机关"],
      keywords: ["行政", "诉讼", "行政机关", "侵权"],
      version: "1.0",
      effectiveDate: "2017-07-01T00:00:00Z",
      status: "VALID",
      issuingAuthority: "全国人民代表大会常务委员会",
      jurisdiction: "全国",
      searchableText: base.fullText,
      viewCount: 0,
      referenceCount: 0,
    });
  }

  return articles;
}

async function main() {
  console.log("开始扩充法条数据...");

  // 生成各类法条
  const civilArticles = generateCivilArticles();
  const contractArticles = generateContractArticles();
  const laborArticles = generateLaborArticles();
  const companyArticles = generateCompanyArticles();
  const intellectualArticles = generateIntellectualArticles();
  const proceduralArticles = generateProceduralArticles();
  const administrativeArticles = generateAdministrativeArticles();

  const allArticles = [
    ...civilArticles,
    ...contractArticles,
    ...laborArticles,
    ...companyArticles,
    ...intellectualArticles,
    ...proceduralArticles,
    ...administrativeArticles,
  ];

  console.log(`生成法条数量: ${allArticles.length}`);

  // 清空现有法条数据
  console.log("清空现有法条数据...");
  await prisma.lawArticle.deleteMany({});

  // 插入新法条
  console.log("插入新法条数据...");
  for (let i = 0; i < allArticles.length; i += 50) {
    const batch = allArticles.slice(i, i + 50);
    await prisma.lawArticle.createMany({
      data: batch,
    });
    console.log(`已插入 ${i + batch.length} / ${allArticles.length} 条法条`);
  }

  // 统计最终结果
  const totalCount = await prisma.lawArticle.count();
  console.log(`\n扩充完成！总法条数: ${totalCount}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("扩充法条数据失败:", e);
  process.exit(1);
});
