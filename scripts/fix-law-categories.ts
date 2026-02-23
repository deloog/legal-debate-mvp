/**
 * 法律法规分类修正迁移脚本
 *
 * 功能：对已入库的 LawCategory.OTHER 记录，通过法律名称关键词推断正确的学科分类
 *
 * 执行方式：npx tsx scripts/fix-law-categories.ts
 *
 * 前置条件：
 * 1. 确保数据库连接正常（.env 中的 DATABASE_URL 已配置）
 * 2. 建议在测试环境先运行验证
 */

import { PrismaClient, LawCategory } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 关键词 → 分类 映射表（按优先级排序，靠前的优先匹配）
 * 优先级高的规则放在前面，确保更精确的分类先被匹配
 */
const KEYWORD_RULES: Array<{
  pattern: RegExp;
  category: LawCategory;
  description: string;
}> = [
  // 刑事类（优先级最高，因为刑事法通常有明确的"刑法"标识）
  {
    pattern: /刑法|刑事诉讼|治安管理处罚|监狱法|劳动教养/,
    category: LawCategory.CRIMINAL,
    description: '刑事法律',
  },
  // 劳动类
  {
    pattern:
      /劳动合同法|劳动法|就业促进法|工伤保险条例|职工|工会法|劳动争议|劳动保障|劳动合同|职工代表大会|集体合同|最低工资|工作时间和休息休假|女职工保护|未成年工保护/,
    category: LawCategory.LABOR,
    description: '劳动法律法规',
  },
  // 知识产权类
  {
    pattern:
      /专利法|商标法|著作权法|知识产权|反不正当竞争法|植物新品种保护条例/,
    category: LawCategory.INTELLECTUAL_PROPERTY,
    description: '知识产权法',
  },
  // 商事/经济法类
  {
    pattern:
      /公司法|证券法|保险法|银行业监督管理|票据法|破产法|期货交易管理|企业国有资产|金融|外汇|公司登记|企业登记|合伙企业|个人独资企业/,
    category: LawCategory.COMMERCIAL,
    description: '商法',
  },
  // 民法类
  {
    pattern:
      /民法典|合同法|物权法|婚姻法|继承法|侵权责任法|民事诉讼法|收养法|抵押法|质押法|担保法|民法通则|人格权|个人信息保护|债权|所有权|用益物权|担保物权/,
    category: LawCategory.CIVIL,
    description: '民事法律',
  },
  // 行政类
  {
    pattern:
      /行政许可法|行政处罚法|行政复议法|行政诉讼法|公务员法|政府采购法|国家赔偿法|行政强制法|行政处罚|行政管理|城市管理|市容环境卫生|绿化|市政公用|行政执法|行政检查/,
    category: LawCategory.ADMINISTRATIVE,
    description: '行政法',
  },
  // 经济管理类（环保/食药/安全生产等）
  {
    pattern:
      /环境保护法|食品安全法|药品管理法|安全生产法|消费者权益保护法|价格法|反垄断法|反洗钱法|电信条例|互联网信息服务|产品质量|计量|标准化|认证认可|特种设备|危险化学品|消防|道路交通|道路运输|公路|航道|港口|市场监管/,
    category: LawCategory.ECONOMIC,
    description: '经济管理法',
  },
  // 程序法类
  {
    pattern:
      /诉讼法|仲裁法|司法鉴定|法院组织法|检察院组织法|人民调解法|公证法|仲裁委员会|人民调解|司法协助|引渡|法律援助|律师|公证/,
    category: LawCategory.PROCEDURE,
    description: '程序法',
  },
  // 地方性法规 - 民政/社会保障类
  {
    pattern:
      /最低生活保障|医疗救助|临时救助|流浪乞讨人员|收养登记|殡葬管理|婚姻登记|社会团体|民办非企业单位|基金会|志愿服务|老龄工作|残疾人保障|妇女儿童|社会救助|社会福利|慈善事业/,
    category: LawCategory.LABOR,
    description: '民政社会保障',
  },
  // 地方性法规 - 城市建设/规划类
  {
    pattern:
      /城乡规划|城市总体规划|控制性详细规划|修建性详细规划|土地利用总体规划|国土空间规划|房地产开发|物业管理|房屋租赁|住宅建筑|公共租赁住房|经济适用房|城市建设|市政工程|供水|供热|供气|污水处理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '城乡规划建设',
  },
  // 地方性法规 - 环境保护类
  {
    pattern:
      /污染防治|水污染防治|大气污染防治|固体废物|噪声污染防治|辐射污染防治|生态保护|湿地保护|水源地保护|排污许可|环境影响评价|环境监测|自然保护地|生物多样性保护/,
    category: LawCategory.ECONOMIC,
    description: '环境保护',
  },
  // 地方性法规 - 农林牧渔类
  {
    pattern:
      /农业|农村|农民|乡村振兴|耕地保护|基本农田|土地管理|林业|森林保护|草原保护|渔业|水产|畜牧|动物防疫|农作物种子|农药管理|兽药管理|种畜禽管理|饲料|饲料添加剂/,
    category: LawCategory.ECONOMIC,
    description: '农业农村',
  },
  // 地方性法规 - 教育科技类
  {
    pattern:
      /教育|学校|教师|义务教育|职业教育|民办教育|科学技术|科技进步|技术创新|科技成果转化|高等教育|基础教育|学前教育|特殊教育/,
    category: LawCategory.ADMINISTRATIVE,
    description: '教育科技',
  },
  // 地方性法规 - 文化卫生类
  {
    pattern:
      /文化|文物保护|非物质文化遗产|广播电视|新闻出版|卫生|医疗机构|医疗管理|传染病防治|突发公共卫生事件|人口与计划生育|公共文化服务|文化市场|旅游|文物/,
    category: LawCategory.ADMINISTRATIVE,
    description: '文化卫生',
  },
  // 地方性法规 - 公安/司法行政类
  {
    pattern:
      /公安机关|人民警察|治安管理|网络安全|禁毒|出境入境|枪支管理|爆炸物品管理|特种行业|司法行政|社区矫正|安置帮教/,
    category: LawCategory.ADMINISTRATIVE,
    description: '公安司法',
  },
  // 地方性法规 - 财政/税务类
  {
    pattern:
      /财政|税务|税收|非税收入|预算管理|国债|政府采购|会计|注册会计师|国有资产/,
    category: LawCategory.ECONOMIC,
    description: '财政税务',
  },
  // 地方性法规 - 交通/物流类
  {
    pattern:
      /交通运输|道路运输|水路运输|铁路运输|航空运输|城市公共交通|出租车|网约车|物流|快递|停车场|机动车|非机动车/,
    category: LawCategory.ECONOMIC,
    description: '交通运输',
  },
  // 地方性法规 - 水利/电力/能源类
  {
    pattern:
      /水利|水资源|防汛抗旱|灌溉|水文|电力|能源|石油|天然气|煤炭|可再生能源|节能/,
    category: LawCategory.ECONOMIC,
    description: '能源水利',
  },
  // 地方性法规 - 房地产/建筑类
  {
    pattern:
      /房地产|建筑|建筑业|工程勘察|工程设计|施工|监理|造价|招投标|工程质量|安全生产|建筑节能|绿色建筑/,
    category: LawCategory.ECONOMIC,
    description: '房地产建筑',
  },
  // 地方性法规 - 人事/编制类
  {
    pattern: /人事|编制|事业单位|公务员|干部|工资|职称|专业技术人员|人才流动/,
    category: LawCategory.ADMINISTRATIVE,
    description: '人事编制',
  },
  // 地方性法规 - 民族/宗教类
  {
    pattern: /民族区域自治|民族乡|民族工作|宗教|宗教事务|清真食品/,
    category: LawCategory.ADMINISTRATIVE,
    description: '民族宗教',
  },
  // 地方性法规 - 海洋/渔业类
  {
    pattern: /海洋|海域|海岛|海岸线|渔业|水产|捕捞|养殖|渔船|渔港/,
    category: LawCategory.ECONOMIC,
    description: '海洋渔业',
  },
  // 地方性法规 - 信息化/通信类
  {
    pattern:
      /信息化|大数据|云计算|人工智能|5G|通信|无线电|网络|数据安全|个人信息保护/,
    category: LawCategory.ECONOMIC,
    description: '信息化通信',
  },
  // 地方性法规 - 法规修改废止决定类
  {
    pattern: /关于修改|关于废止|关于修订|关于调整.*的决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '法规修改废止决定',
  },
  // 地方性法规 - 养犬管理
  {
    pattern: /养犬管理|犬类管理|养犬规定|禁止养犬/,
    category: LawCategory.ADMINISTRATIVE,
    description: '养犬管理',
  },
  // 地方性法规 - 营商环境
  {
    pattern: /营商环境|优化营商|商事登记|市场主体|企业开办|企业注销/,
    category: LawCategory.ECONOMIC,
    description: '营商环境',
  },
  // 地方性法规 - 自然保护区/风景名胜区
  {
    pattern:
      /自然保护区|风景名胜区|地质公园|森林公园|湿地公园|自然遗产|文化遗产保护/,
    category: LawCategory.ECONOMIC,
    description: '自然保护地',
  },
  // 地方性法规 - 信访
  {
    pattern: /信访工作|信访条例|信访事项|信访人/,
    category: LawCategory.PROCEDURE,
    description: '信访',
  },
  // 地方性法规 - 自贸区/自由贸易港
  {
    pattern: /自由贸易试验区|自由贸易港|保税区|海关特殊监管区域|跨境电商/,
    category: LawCategory.ECONOMIC,
    description: '自贸区',
  },
  // 地方性法规 - 生态文明建设
  {
    pattern: /生态文明|绿色发展|低碳|节能减排|碳达峰|碳中和/,
    category: LawCategory.ECONOMIC,
    description: '生态文明',
  },
  // 人大/政协议事规则
  {
    pattern: /议事规则|议事规则.*|委员会议事规则|主任会议议事规则/,
    category: LawCategory.PROCEDURE,
    description: '议事规则',
  },
  // 组成人员守则
  {
    pattern: /组成人员守则|组成人员工作守则|工作守则.*组成人员/,
    category: LawCategory.PROCEDURE,
    description: '组成人员守则',
  },
  // 地方性法规 - 其他常见管理类
  {
    pattern: /殡葬改革|祭扫管理|公墓管理|地名管理|门牌管理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '民政管理',
  },
  // 地方性法规 - 水土/水利/水资源类
  {
    pattern: /水土保持|节约用水|水资源管理|水文|水利工程|灌溉|防汛|抗旱/,
    category: LawCategory.ECONOMIC,
    description: '水土水利',
  },
  // 地方性法规 - 生态保护类
  {
    pattern: /山体保护|生态公园|冰川保护|长城保护|沿海防护林|湿地|水源地/,
    category: LawCategory.ECONOMIC,
    description: '生态保护',
  },
  // 地方性法规 - 档案管理
  {
    pattern: /档案条例|档案管理|档案工作/,
    category: LawCategory.PROCEDURE,
    description: '档案管理',
  },
  // 地方性法规 - 地方立法条例
  {
    pattern: /立法条例|制定.*地方性法规|制定.*法规/,
    category: LawCategory.PROCEDURE,
    description: '立法条例',
  },
  // 地方性法规 - 规范性文件备案审查
  {
    pattern: /规范性文件备案审查|备案审查/,
    category: LawCategory.PROCEDURE,
    description: '备案审查',
  },
  // 地方性法规 - 行政复议
  {
    pattern: /行政复议条例|行政复议/,
    category: LawCategory.PROCEDURE,
    description: '行政复议',
  },
  // 地方性法规 - 征兵/军事类
  {
    pattern: /征兵工作|征兵条例|人民防空|国防动员/,
    category: LawCategory.ADMINISTRATIVE,
    description: '征兵国防',
  },
  // 地方性法规 - 专利/知识产权
  {
    pattern: /专利.*条例|专利.*规定|知识产权.*条例|知识产权.*规定/,
    category: LawCategory.INTELLECTUAL_PROPERTY,
    description: '知识产权',
  },
  // 地方性法规 - 环境/水环境保护
  {
    pattern: /水环境保护|水污染防治|大气污染防治|土壤污染防治/,
    category: LawCategory.ECONOMIC,
    description: '水环境保护',
  },
  // 地方性法规 - 粮食/农业流通
  {
    pattern: /粮食流通|农产品质量安全|农业投入品|农药管理|种子管理/,
    category: LawCategory.ECONOMIC,
    description: '粮食流通',
  },
  // 地方性法规 - 慈善/公益
  {
    pattern: /慈善条例|慈善事业|公益事业|捐赠.*条例/,
    category: LawCategory.LABOR,
    description: '慈善公益',
  },
  // 地方性法规 - 发展规划
  {
    pattern: /发展规划|发展规划条例|规划实施/,
    category: LawCategory.ECONOMIC,
    description: '发展规划',
  },
  // 地方性法规 - 未成年人保护
  {
    pattern: /预防未成年人犯罪|未成年人保护|未成年人条例/,
    category: LawCategory.CRIMINAL,
    description: '未成年人保护',
  },
  // 地方性法规 - 实验动物
  {
    pattern: /实验动物|动物防疫|动物检疫/,
    category: LawCategory.ECONOMIC,
    description: '动物管理',
  },
  // 地方性法规 - 粤港澳大湾区
  {
    pattern: /粤港澳大湾区|港澳.*深圳|深港.*合作/,
    category: LawCategory.ECONOMIC,
    description: '大湾区',
  },
  // 地方性法规 - 科技创新
  {
    pattern: /科技创新|科技成果转化|科技奖励|科学技术奖励/,
    category: LawCategory.ECONOMIC,
    description: '科技创新',
  },
  // 地方性法规 - 华侨事务
  {
    pattern: /华侨.*条例|华侨.*规定|归侨|侨眷/,
    category: LawCategory.LABOR,
    description: '华侨事务',
  },
  // 地方性法规 - 核安全
  {
    pattern: /核设施|核事故|核辐射|放射性/,
    category: LawCategory.ECONOMIC,
    description: '核安全',
  },
  // 地方性法规 - 校外托管
  {
    pattern: /校外托管机构|校外培训/,
    category: LawCategory.ADMINISTRATIVE,
    description: '校外托管',
  },
  // 地方性法规 - 反家庭暴力
  {
    pattern: /反家庭暴力|家庭暴力/,
    category: LawCategory.CIVIL,
    description: '反家庭暴力',
  },
  // 地方性法规 - 非物质文化遗产
  {
    pattern: /非物质文化遗产|文物保护|文化遗产|传统村落/,
    category: LawCategory.ADMINISTRATIVE,
    description: '文化遗产',
  },
  // 地方性法规 - 农贸市场
  {
    pattern: /农贸市场|农产品流通|农产品交易/,
    category: LawCategory.ECONOMIC,
    description: '农贸市场',
  },
  // 地方性法规 - 数据/数字经济
  {
    pattern: /数据.*条例|数据.*规定|数字经济|数字政府/,
    category: LawCategory.ECONOMIC,
    description: '数字经济',
  },
  // 地方性法规 - 气候资源
  {
    pattern: /气候资源|新能源|可再生能源|清洁能源/,
    category: LawCategory.ECONOMIC,
    description: '气候资源',
  },
  // 地方性法规 - 科创园/园区发展
  {
    pattern: /科创园|科技创新园|高新区|开发区.*促进/,
    category: LawCategory.ECONOMIC,
    description: '科技创新园区',
  },
  // 地方性法规 - 文明行为促进
  {
    pattern: /文明行为促进|文明城市|精神文明建设/,
    category: LawCategory.ADMINISTRATIVE,
    description: '文明促进',
  },
  // 地方性法规 - 市容/城市管理
  {
    pattern: /市容管理|市容环境卫生|城市管理综合执法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '市容管理',
  },
  // 地方性法规 - 内河湖泊
  {
    pattern: /内河|湖泊保护|河道管理|河长制/,
    category: LawCategory.ECONOMIC,
    description: '河湖保护',
  },
  // 地方性法规 - 违法建设治理
  {
    pattern: /违法建设|违法建筑|违法建设治理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '违法建设治理',
  },
  // 地方性法规 - 政务服务
  {
    pattern: /政务服务|便民热线|行政审批.*改革|一网通办/,
    category: LawCategory.ADMINISTRATIVE,
    description: '政务服务',
  },
  // 地方性法规 - 消防/应急
  {
    pattern: /消防.*条例|消防.*规定|应急管理|安全生产/,
    category: LawCategory.ECONOMIC,
    description: '消防应急',
  },
  // 地方性法规 - 燃气/天然气
  {
    pattern: /燃气管理|天然气|城镇燃气|供热|供气/,
    category: LawCategory.ECONOMIC,
    description: '燃气管理',
  },
  // 地方性法规 - 药品/医疗器械
  {
    pattern: /药品.*条例|医疗器械|疫苗管理|医疗机构药事/,
    category: LawCategory.ECONOMIC,
    description: '药品管理',
  },
  // 地方性法规 - 交通出行
  {
    pattern: /公共交通|轨道交通|网约车|共享单车|停车场/,
    category: LawCategory.ECONOMIC,
    description: '交通出行',
  },
  // 地方性法规 - 物业管理
  {
    pattern: /物业管理|业主大会|业主委员会/,
    category: LawCategory.CIVIL,
    description: '物业管理',
  },
  // 地方性法规 - 历史文化街区
  {
    pattern: /历史文化街区|历史建筑|传统风貌/,
    category: LawCategory.ADMINISTRATIVE,
    description: '历史文化保护',
  },
  // 地方性法规 - 城市更新
  {
    pattern: /城市更新|老旧小区改造|棚户区改造/,
    category: LawCategory.ADMINISTRATIVE,
    description: '城市更新',
  },
  // 地方性法规 - 国土空间规划
  {
    pattern: /国土空间规划|详细规划|规划管理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '国土空间规划',
  },
  // 地方性法规 - 土壤/固废
  {
    pattern: /土壤污染防治|固体废物|危险废物/,
    category: LawCategory.ECONOMIC,
    description: '土壤固废',
  },
  // 地方性法规 - 交通综合执法
  {
    pattern: /交通运输|公路管理|道路运输|交通综合执法/,
    category: LawCategory.ECONOMIC,
    description: '交通运输',
  },
  // 人大决定类 - 经济发展
  {
    pattern: /经济发展|产业.*发展|促进.*发展|高质量发展/,
    category: LawCategory.ECONOMIC,
    description: '经济发展',
  },
  // 人大决定类 - 就业促进
  {
    pattern: /促进就业|就业工作|稳就业|就业促进/,
    category: LawCategory.LABOR,
    description: '就业促进',
  },
  // 人大决定类 - 法律监督
  {
    pattern: /法律监督|检察机关法律监督|检察.*监督/,
    category: LawCategory.PROCEDURE,
    description: '法律监督',
  },
  // 人大决定类 - 环境资源保护
  {
    pattern: /环境资源.*保护|生物多样性|生态.*保护|黑土地保护/,
    category: LawCategory.ECONOMIC,
    description: '环境资源保护',
  },
  // 人大决定类 - 司法政策
  {
    pattern: /少捕慎诉慎押|扫黑除恶|执行工作|切实解决执行难/,
    category: LawCategory.CRIMINAL,
    description: '司法政策',
  },
  // 人大决定类 - 重大活动保障
  {
    pattern: /冬奥会|冬残奥会|亚运会|亚残运会|赛事保障|临时性行政措施/,
    category: LawCategory.ADMINISTRATIVE,
    description: '重大活动保障',
  },
  // 人大决定类 - 人大换届选举
  {
    pattern: /换届选举|人民代表大会.*换届|代表.*换届/,
    category: LawCategory.PROCEDURE,
    description: '换届选举',
  },
  // 人大决定类 - 地方管理体制
  {
    pattern: /合作区|深度合作|管理体制/,
    category: LawCategory.ADMINISTRATIVE,
    description: '地方管理体制',
  },
  // 人大决定类 - 契税
  {
    pattern: /契税.*适用税率|契税.*事项|契税.*免征|契税.*减征/,
    category: LawCategory.ECONOMIC,
    description: '契税',
  },
  // 人大决定类 - 流域保护
  {
    pattern: /长江流域.*禁捕|流域.*保护|赤水河.*保护/,
    category: LawCategory.ECONOMIC,
    description: '流域保护',
  },
  // 人大决定类 - 预算审查监督
  {
    pattern: /预算审查监督|预算.*审查|加强预算/,
    category: LawCategory.ADMINISTRATIVE,
    description: '预算审查',
  },
  // 人大决定类 - 公益诉讼
  {
    pattern: /公益诉讼|检察公益诉讼/,
    category: LawCategory.PROCEDURE,
    description: '公益诉讼',
  },
  // 人大决定类 - 城市运行
  {
    pattern: /城市运行|一网统管|城市管理.*改革/,
    category: LawCategory.ADMINISTRATIVE,
    description: '城市运行',
  },
  // 人大决定类 - 防范化解风险
  {
    pattern: /防范化解.*风险|重大风险/,
    category: LawCategory.ADMINISTRATIVE,
    description: '防范风险',
  },
  // 人大决定类 - 文明生活
  {
    pattern: /公筷公勺|文明.*促进|文明.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '文明生活',
  },
  // 人大决定类 - 民族自治地方相关
  {
    pattern: /自治区.*纪念日|藏历新年|民族自治.*决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '民族自治',
  },
  // 地方性法规 - 招商引资
  {
    pattern: /招商引资|投资促进|投资保护/,
    category: LawCategory.ECONOMIC,
    description: '招商引资',
  },
  // 地方性法规 - 产业园区
  {
    pattern: /产业园区|产业园|工业集聚区/,
    category: LawCategory.ECONOMIC,
    description: '产业园区',
  },
  // 地方性法规 - 人才发展
  {
    pattern: /人才.*发展|人才引进|人才培养/,
    category: LawCategory.LABOR,
    description: '人才发展',
  },
  // 地方性法规 - 社会治理
  {
    pattern: /社会治理|基层治理|社区治理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '社会治理',
  },
  // 人大决定类 - 监督司法
  {
    pattern: /监督司法|司法工作监督|法院.*监督|检察.*监督/,
    category: LawCategory.PROCEDURE,
    description: '监督司法',
  },
  // 人大决定类 - 刑事案件
  {
    pattern: /刑事案件|办案期限|刑事诉讼/,
    category: LawCategory.CRIMINAL,
    description: '刑事案件',
  },
  // 地方性法规 - 社会治安
  {
    pattern: /社会治安综合治理|综合治理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '社会治安',
  },
  // 地方性法规 - 市场中介
  {
    pattern: /市场中介|中介组织/,
    category: LawCategory.ECONOMIC,
    description: '市场中介',
  },
  // 地方性法规 - 艾滋病防治
  {
    pattern: /艾滋病防治|艾滋病.*条例/,
    category: LawCategory.ECONOMIC,
    description: '艾滋病防治',
  },
  // 地方性法规 - 户外广告
  {
    pattern: /户外广告|广告管理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '户外广告',
  },
  // 地方性法规 - 技术市场
  {
    pattern: /技术市场|技术交易/,
    category: LawCategory.ECONOMIC,
    description: '技术市场',
  },
  // 地方性法规 - 农牧民负担
  {
    pattern: /农牧民负担|农民负担|减轻农民负担/,
    category: LawCategory.ECONOMIC,
    description: '农牧民负担',
  },
  // 地方性法规 - 经纪人管理
  {
    pattern: /经纪人管理|经纪人条例/,
    category: LawCategory.ECONOMIC,
    description: '经纪人管理',
  },
  // 地方性法规 - 经济技术开发区
  {
    pattern: /经济技术开发区|经济开发区|产业园区/,
    category: LawCategory.ECONOMIC,
    description: '经济技术开发区',
  },
  // 地方性法规 - 自治条例
  {
    pattern: /自治条例|自治州.*自治条例|自治县.*自治条例/,
    category: LawCategory.PROCEDURE,
    description: '自治条例',
  },
  // 地方性法规 - 民族自治地方
  {
    pattern: /民族自治县|自治县|民族自治州|自治州/,
    category: LawCategory.ADMINISTRATIVE,
    description: '民族自治地方',
  },
  // 地方性法规 - 荣誉市民
  {
    pattern: /荣誉市民|市民称号/,
    category: LawCategory.ADMINISTRATIVE,
    description: '荣誉市民',
  },
  // 地方性法规 - 人大决议
  {
    pattern: /关于.*建设问题的决议|关于.*问题的决议|关于.*事项的决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '人大决议',
  },
  // 地方性法规 - 民族地区发展
  {
    pattern: /民族地区|老区建设|民族发展/,
    category: LawCategory.ECONOMIC,
    description: '民族地区发展',
  },
  // 地方性法规 - 节日/纪念日
  {
    pattern: /老人节|节日.*决定|设立.*节/,
    category: LawCategory.ADMINISTRATIVE,
    description: '节日纪念日',
  },
  // 地方性法规 - 区域协同发展
  {
    pattern: /区域协同|协同发展|一体化发展/,
    category: LawCategory.ECONOMIC,
    description: '区域协同',
  },
  // 地方性法规 - 特色产业
  {
    pattern: /.*发展促进条例|产业保护.*条例/,
    category: LawCategory.ECONOMIC,
    description: '特色产业',
  },
  // 地方性法规 - 地方荣誉称号
  {
    pattern: /荣誉称号|荣誉市民.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '地方荣誉',
  },
  // 人大决定类 - 生态绿色发展
  {
    pattern: /生态绿色|绿色发展.*一体化/,
    category: LawCategory.ECONOMIC,
    description: '生态绿色',
  },
  // 地方性法规 - 投资促进
  {
    pattern: /投资促进|投资.*局/,
    category: LawCategory.ECONOMIC,
    description: '投资促进',
  },
  // 地方性法规 - 示范区建设
  {
    pattern: /示范区建设|示范区.*若干/,
    category: LawCategory.ECONOMIC,
    description: '示范区建设',
  },
  // 地方性法规 - 老年人权益保障
  {
    pattern: /老年人权益保障|老年人.*条例/,
    category: LawCategory.LABOR,
    description: '老年人权益',
  },
  // 地方性法规 - 见义勇为
  {
    pattern: /见义勇为.*条例|奖励和保护见义勇为/,
    category: LawCategory.ADMINISTRATIVE,
    description: '见义勇为',
  },
  // 地方性法规 - 烟花爆竹
  {
    pattern: /烟花爆竹.*管理|燃放.*烟花/,
    category: LawCategory.ADMINISTRATIVE,
    description: '烟花爆竹',
  },
  // 地方性法规 - 生猪屠宰
  {
    pattern: /生猪屠宰|屠宰.*条例/,
    category: LawCategory.ECONOMIC,
    description: '生猪屠宰',
  },
  // 地方性法规 - 水库保护
  {
    pattern: /水库.*保护|水源保护.*条例/,
    category: LawCategory.ECONOMIC,
    description: '水库保护',
  },
  // 地方性法规 - 学生体质健康
  {
    pattern: /学生体质健康|学生.*健康促进/,
    category: LawCategory.ADMINISTRATIVE,
    description: '学生健康',
  },
  // 地方性法规 - 村务公开
  {
    pattern: /村务公开|村务公开.*条例/,
    category: LawCategory.PROCEDURE,
    description: '村务公开',
  },
  // 地方性法规 - 义务植树
  {
    pattern: /义务植树|植树.*条例/,
    category: LawCategory.ECONOMIC,
    description: '义务植树',
  },
  // 地方性法规 - 水质保护
  {
    pattern: /水质保护|饮用水.*保护/,
    category: LawCategory.ECONOMIC,
    description: '水质保护',
  },
  // 地方性法规 - 地下水管理
  {
    pattern: /地下水.*管理|地下水.*条例/,
    category: LawCategory.ECONOMIC,
    description: '地下水',
  },
  // 地方性法规 - 国家建设项目审计
  {
    pattern: /国家建设项目审计|审计.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '审计',
  },
  // 地方性法规 - 质询工作
  {
    pattern: /质询工作|开展质询/,
    category: LawCategory.PROCEDURE,
    description: '质询工作',
  },
  // 地方性法规 - 电信设施
  {
    pattern: /电信设施|通信设施/,
    category: LawCategory.ECONOMIC,
    description: '电信设施',
  },
  // 地方性法规 - 宪法宣誓
  {
    pattern: /宪法宣誓|宣誓.*办法/,
    category: LawCategory.PROCEDURE,
    description: '宪法宣誓',
  },
  // 地方性法规 - 城市道路通行
  {
    pattern: /城市道路.*通行|车辆通行/,
    category: LawCategory.ECONOMIC,
    description: '道路通行',
  },
  // 地方性法规 - 气象灾害防御
  {
    pattern: /气象灾害.*防御|防震减灾/,
    category: LawCategory.ECONOMIC,
    description: '气象防御',
  },
  // 地方性法规 - 城市地下管线
  {
    pattern: /地下管线|地下管道/,
    category: LawCategory.ADMINISTRATIVE,
    description: '地下管线',
  },
  // 地方性法规 - 史迹保护
  {
    pattern: /史迹保护|文化遗产保护.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '史迹保护',
  },
  // 地方性法规 - 社会工作服务
  {
    pattern: /社会工作服务|社会工作.*条例/,
    category: LawCategory.LABOR,
    description: '社会工作',
  },
  // 地方性法规 - 林木种苗
  {
    pattern: /林木种苗|种苗.*条例/,
    category: LawCategory.ECONOMIC,
    description: '林木种苗',
  },
  // 地方性法规 - 防沙治沙
  {
    pattern: /防沙治沙|沙漠化/,
    category: LawCategory.ECONOMIC,
    description: '防沙治沙',
  },
  // 地方性法规 - 水源涵养
  {
    pattern: /水源涵养|涵养功能区/,
    category: LawCategory.ECONOMIC,
    description: '水源涵养',
  },
  // 地方性法规 - 红十字会
  {
    pattern: /红十字会.*实施办法|红十字会.*办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '红十字会',
  },
  // 地方性法规 - 预付消费卡
  {
    pattern: /预付消费卡|预付卡管理/,
    category: LawCategory.ECONOMIC,
    description: '预付消费卡',
  },
  // 地方性法规 - 重大事项决定
  {
    pattern: /讨论决定重大事项|重大事项.*决定/,
    category: LawCategory.PROCEDURE,
    description: '重大事项',
  },
  // 地方性法规 - 台湾船舶停泊
  {
    pattern: /台湾船舶.*停泊|船舶停泊点/,
    category: LawCategory.ECONOMIC,
    description: '台湾船舶',
  },
  // 地方性法规 - 渡口管理
  {
    pattern: /渡口管理|渡口.*条例/,
    category: LawCategory.ECONOMIC,
    description: '渡口管理',
  },
  // 地方性法规 - 防洪法实施
  {
    pattern: /防洪法.*实施办法|防洪.*条例/,
    category: LawCategory.ECONOMIC,
    description: '防洪',
  },
  // 地方性法规 - 罚款限额
  {
    pattern: /罚款限额|设定罚款.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '罚款限额',
  },
  // 地方性法规 - 气象法实施
  {
    pattern: /气象法.*实施办法|气象.*条例/,
    category: LawCategory.ECONOMIC,
    description: '气象',
  },
  // 地方性法规 - 市民服务热线
  {
    pattern: /市民服务热线|12345热线/,
    category: LawCategory.ADMINISTRATIVE,
    description: '市民热线',
  },
  // 地方性法规 - 矿产资源管理
  {
    pattern: /矿产资源.*管理|矿产.*条例/,
    category: LawCategory.ECONOMIC,
    description: '矿产资源',
  },
  // 地方性法规 - 风景区
  {
    pattern: /风景区条例|.*风景区.*保护/,
    category: LawCategory.ECONOMIC,
    description: '风景区',
  },
  // 地方性法规 - 林地保护
  {
    pattern: /林地保护.*条例|林地.*管理/,
    category: LawCategory.ECONOMIC,
    description: '林地保护',
  },
  // 地方性法规 - 行政审批中介
  {
    pattern: /行政审批中介|中介服务/,
    category: LawCategory.ADMINISTRATIVE,
    description: '中介服务',
  },
  // 地方性法规 - 养老服务
  {
    pattern: /养老服务|居家养老|社区养老/,
    category: LawCategory.LABOR,
    description: '养老服务',
  },
  // 地方性法规 - 河渠管理
  {
    pattern: /河渠管理|河道管理|渠.*管理/,
    category: LawCategory.ECONOMIC,
    description: '河渠管理',
  },
  // 地方性法规 - 人力资源市场
  {
    pattern: /人力资源市场|人力资源.*促进/,
    category: LawCategory.LABOR,
    description: '人力资源',
  },
  // 地方性法规 - 终身学习
  {
    pattern: /终身学习|学习型社会/,
    category: LawCategory.ADMINISTRATIVE,
    description: '终身学习',
  },
  // 地方性法规 - 矿山生态修复
  {
    pattern: /矿山生态修复|生态修复.*条例/,
    category: LawCategory.ECONOMIC,
    description: '矿山修复',
  },
  // 地方性法规 - 人大代表工作
  {
    pattern: /人大代表.*工作|代表联络站/,
    category: LawCategory.PROCEDURE,
    description: '代表工作',
  },
  // 地方性法规 - 法治乡村
  {
    pattern: /法治乡村|乡村.*法治/,
    category: LawCategory.ADMINISTRATIVE,
    description: '法治乡村',
  },
  // 地方性法规 - 社会信用
  {
    pattern: /社会信用|信用促进|信用条例/,
    category: LawCategory.ECONOMIC,
    description: '社会信用',
  },
  // 地方性法规 - 电梯安全管理
  {
    pattern: /电梯.*管理|电梯安全/,
    category: LawCategory.ADMINISTRATIVE,
    description: '电梯安全',
  },
  // 地方性法规 - 特色产品保护
  {
    pattern: /.*保护条例|.*保护和发展/,
    category: LawCategory.ECONOMIC,
    description: '特色产品',
  },
  // 地方性法规 - 餐厨废弃物
  {
    pattern: /餐厨废弃物|餐厨垃圾/,
    category: LawCategory.ECONOMIC,
    description: '餐厨废弃物',
  },
  // 地方性法规 - 电动自行车
  {
    pattern: /电动自行车.*管理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '电动自行车',
  },
  // 地方性法规 - 绿色矿山
  {
    pattern: /绿色矿山|矿山建设/,
    category: LawCategory.ECONOMIC,
    description: '绿色矿山',
  },
  // 地方性法规 - 传统文化保护
  {
    pattern: /.*保护传承|.*保护条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '文化保护',
  },
  // 地方性法规 - 红色资源
  {
    pattern: /红色资源|革命遗址/,
    category: LawCategory.ADMINISTRATIVE,
    description: '红色资源',
  },
  // 地方性法规 - 公共交通
  {
    pattern: /公共汽车客运|公共交通.*条例/,
    category: LawCategory.ECONOMIC,
    description: '公共交通',
  },
  // 地方性法规 - 民宿管理
  {
    pattern: /民宿.*管理|民宿促进/,
    category: LawCategory.ADMINISTRATIVE,
    description: '民宿管理',
  },
  // 地方性法规 - 数字贸易
  {
    pattern: /数字贸易|数字经济.*促进/,
    category: LawCategory.ECONOMIC,
    description: '数字贸易',
  },
  // 地方性法规 - 矛盾纠纷化解
  {
    pattern: /矛盾纠纷.*化解|多元化解/,
    category: LawCategory.PROCEDURE,
    description: '纠纷化解',
  },
  // 地方性法规 - 技术工人
  {
    pattern: /技术工人.*待遇|中等收入群体/,
    category: LawCategory.LABOR,
    description: '技术工人',
  },
  // 地方性法规 - 智能网联车辆
  {
    pattern: /智能网联车辆|自动驾驶.*测试/,
    category: LawCategory.ECONOMIC,
    description: '智能网联',
  },
  // 地方性法规 - 水上交通
  {
    pattern: /水上交通|水上交通事故/,
    category: LawCategory.ECONOMIC,
    description: '水上交通',
  },
  // 地方性法规 - 陶瓷保护
  {
    pattern: /陶瓷保护|.*制.*保护/,
    category: LawCategory.ADMINISTRATIVE,
    description: '陶瓷保护',
  },
  // 地方性法规 - 古迹保护
  {
    pattern: /古巷保护|古城保护|遗址保护/,
    category: LawCategory.ADMINISTRATIVE,
    description: '古迹保护',
  },
  // 地方性法规 - 充电设施
  {
    pattern: /充电设施|充电桩/,
    category: LawCategory.ADMINISTRATIVE,
    description: '充电设施',
  },
  // 地方性法规 - 公共图书馆
  {
    pattern: /公共图书馆|图书馆.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '公共图书馆',
  },
  // 地方性法规 - 公共法律服务
  {
    pattern: /公共法律服务|法律服务.*条例/,
    category: LawCategory.PROCEDURE,
    description: '公共法律服务',
  },
  // 地方性法规 - 长城古堡保护
  {
    pattern: /长城.*保护|古堡保护/,
    category: LawCategory.ADMINISTRATIVE,
    description: '长城古堡',
  },
  // 地方性法规 - 森林资源
  {
    pattern: /森林资源.*条例|森林.*管理/,
    category: LawCategory.ECONOMIC,
    description: '森林资源',
  },
  // 地方性法规 - 主任会议
  {
    pattern: /主任会议.*规则|主任会议.*工作/,
    category: LawCategory.PROCEDURE,
    description: '主任会议',
  },
  // 地方性法规 - 档案安全
  {
    pattern: /档案安全|档案.*保护/,
    category: LawCategory.PROCEDURE,
    description: '档案安全',
  },
  // 地方性法规 - 少数民族权益
  {
    pattern: /少数民族权益|民族权益保障/,
    category: LawCategory.ADMINISTRATIVE,
    description: '少数民族权益',
  },
  // 地方性法规 - 环境保护
  {
    pattern: /.*环境保护条例|.*环境保护.*规定/,
    category: LawCategory.ECONOMIC,
    description: '环境保护',
  },
  // 地方性法规 - 立法程序
  {
    pattern: /立法程序规定|立法程序.*规定/,
    category: LawCategory.PROCEDURE,
    description: '立法程序',
  },
  // 地方性法规 - 农田地膜
  {
    pattern: /农田地膜|地膜管理/,
    category: LawCategory.ECONOMIC,
    description: '农田地膜',
  },
  // 地方性法规 - 全民健身
  {
    pattern: /全民健身.*条例|健身.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '全民健身',
  },
  // 地方性法规 - 医疗急救
  {
    pattern: /医疗急救|院前急救/,
    category: LawCategory.ECONOMIC,
    description: '医疗急救',
  },
  // 地方性法规 - 城市管理
  {
    pattern: /城市管理.*条例|城镇.*管理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '城市管理',
  },
  // 地方性法规 - 消费领域权益保护
  {
    pattern: /消费.*消费者权益|保健产品.*消费者/,
    category: LawCategory.ECONOMIC,
    description: '消费权益',
  },
  // 地方性法规 - 景区保护
  {
    pattern: /景区.*保护管理|保护区.*条例/,
    category: LawCategory.ECONOMIC,
    description: '景区保护',
  },
  // 地方性法规 - 控制吸烟
  {
    pattern: /控制吸烟|公共场所.*吸烟/,
    category: LawCategory.ADMINISTRATIVE,
    description: '控制吸烟',
  },
  // 地方性法规 - 行政审批效能
  {
    pattern: /行政审批效能|提升行政审批/,
    category: LawCategory.ADMINISTRATIVE,
    description: '行政审批',
  },
  // 地方性法规 - 大风灾害防御
  {
    pattern: /大风灾害|灾害防御/,
    category: LawCategory.ECONOMIC,
    description: '灾害防御',
  },
  // 地方性法规 - 野外用火管理
  {
    pattern: /野外用火|用火管理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '野外用火',
  },
  // 地方性法规 - 地下综合管廊
  {
    pattern: /地下综合管廊|综合管廊/,
    category: LawCategory.ADMINISTRATIVE,
    description: '地下管廊',
  },
  // 地方性法规 - 开发区
  {
    pattern: /开发区条例|经济技术开发区/,
    category: LawCategory.ECONOMIC,
    description: '开发区',
  },
  // 地方性法规 - 社会组织管理
  {
    pattern: /社会组织.*管理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '社会组织',
  },
  // 地方性法规 - 摩托车管理
  {
    pattern: /摩托车管理|摩托车.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '摩托车',
  },
  // 地方性法规 - 散装水泥
  {
    pattern: /散装水泥|水泥管理/,
    category: LawCategory.ECONOMIC,
    description: '散装水泥',
  },
  // 地方性法规 - 去极端化
  {
    pattern: /去极端化|极端化/,
    category: LawCategory.ADMINISTRATIVE,
    description: '去极端化',
  },
  // 地方性法规 - 反恐怖主义
  {
    pattern: /反恐怖主义|反恐.*办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '反恐',
  },
  // 地方性法规 - 污染物排放
  {
    pattern: /污染物排放|减少污染物/,
    category: LawCategory.ECONOMIC,
    description: '污染物',
  },
  // 地方性法规 - 野生动物保护
  {
    pattern: /野生动物保护法.*实施|野生动物.*办法/,
    category: LawCategory.ECONOMIC,
    description: '野生动物',
  },
  // 地方性法规 - 林木种子
  {
    pattern: /林木种子|种子.*条例/,
    category: LawCategory.ECONOMIC,
    description: '林木种子',
  },
  // 地方性法规 - 工业污染监督
  {
    pattern: /工业污染监督|重点工业/,
    category: LawCategory.ECONOMIC,
    description: '工业污染',
  },
  // 地方性法规 - 水法实施
  {
    pattern: /水法.*实施|水法.*办法/,
    category: LawCategory.ECONOMIC,
    description: '水法',
  },
  // 地方性法规 - 黄河工程管理
  {
    pattern: /黄河工程|水利工程.*管理/,
    category: LawCategory.ECONOMIC,
    description: '黄河工程',
  },
  // 地方性法规 - 森林防火
  {
    pattern: /森林防火|防火.*条例/,
    category: LawCategory.ECONOMIC,
    description: '森林防火',
  },
  // 地方性法规 - 铁路安全管理
  {
    pattern: /铁路安全管理|铁路.*条例/,
    category: LawCategory.ECONOMIC,
    description: '铁路安全',
  },
  // 地方性法规 - 土地监察
  {
    pattern: /土地监察|监察.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '土地监察',
  },
  // 地方性法规 - 统计管理
  {
    pattern: /统计管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '统计管理',
  },
  // 地方性法规 - 蚕种管理
  {
    pattern: /蚕种管理|蚕种.*条例/,
    category: LawCategory.ECONOMIC,
    description: '蚕种',
  },
  // 地方性法规 - 母婴保健
  {
    pattern: /母婴保健|母婴.*办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '母婴保健',
  },
  // 地方性法规 - 招标投标
  {
    pattern: /招标投标.*条例/,
    category: LawCategory.ECONOMIC,
    description: '招标投标',
  },
  // 地方性法规 - 城市公园
  {
    pattern: /城市公园.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '城市公园',
  },
  // 地方性法规 - 立法程序规则
  {
    pattern: /立法程序规则|立法程序.*规则/,
    category: LawCategory.PROCEDURE,
    description: '立法程序',
  },
  // 地方性法规 - 草原保护
  {
    pattern: /草原.*条例|草原.*办法/,
    category: LawCategory.ECONOMIC,
    description: '草原',
  },
  // 地方性法规 - 奶业
  {
    pattern: /奶业.*条例|乳业/,
    category: LawCategory.ECONOMIC,
    description: '奶业',
  },
  // 地方性法规 - 价格鉴证
  {
    pattern: /价格鉴证|涉案物.*鉴证/,
    category: LawCategory.ADMINISTRATIVE,
    description: '价格鉴证',
  },
  // 地方性法规 - 反窃电
  {
    pattern: /反窃电|窃电.*条例/,
    category: LawCategory.ECONOMIC,
    description: '反窃电',
  },
  // 人大决定类 - 学习贯彻宪法
  {
    pattern: /学习宣传.*宪法|贯彻实施宪法/,
    category: LawCategory.PROCEDURE,
    description: '学习贯彻宪法',
  },
  // 地方性法规 - 防洪法实施
  {
    pattern: /防洪法.*实施|防洪法.*办法/,
    category: LawCategory.ECONOMIC,
    description: '防洪',
  },
  // 地方性法规 - 代表履职管理
  {
    pattern: /代表履职.*管理|履职.*办法/,
    category: LawCategory.PROCEDURE,
    description: '代表履职',
  },
  // 地方性法规 - 气象法实施
  {
    pattern: /气象法.*实施|气象法.*办法/,
    category: LawCategory.ECONOMIC,
    description: '气象法',
  },
  // 地方性法规 - 民办教育
  {
    pattern: /民办.*学校|民办中小学|民办教育/,
    category: LawCategory.ADMINISTRATIVE,
    description: '民办教育',
  },
  // 地方性法规 - 备案审查规章
  {
    pattern: /审查备案规章|备案审查.*规定/,
    category: LawCategory.PROCEDURE,
    description: '备案审查',
  },
  // 地方性法规 - 森林法实施
  {
    pattern: /森林法.*实施|森林法.*办法/,
    category: LawCategory.ECONOMIC,
    description: '森林法',
  },
  // 地方性法规 - 乡镇企业法实施
  {
    pattern: /乡镇企业法.*实施|乡镇企业法.*办法/,
    category: LawCategory.ECONOMIC,
    description: '乡镇企业法',
  },
  // 地方性法规 - 村民委员会组织法实施
  {
    pattern: /村民委员会组织法.*实施|村民委员会.*办法/,
    category: LawCategory.PROCEDURE,
    description: '村民自治',
  },
  // 地方性法规 - 有线电视
  {
    pattern: /有线电视.*条例/,
    category: LawCategory.ECONOMIC,
    description: '有线电视',
  },
  // 地方性法规 - 村民委员会选举
  {
    pattern: /村民委员会选举|选举.*办法/,
    category: LawCategory.PROCEDURE,
    description: '村委会选举',
  },
  // 地方性法规 - 社会保障基金审计
  {
    pattern: /社会保障基金审计|基金.*审计/,
    category: LawCategory.ADMINISTRATIVE,
    description: '社保审计',
  },
  // 地方性法规 - 义务兵征集
  {
    pattern: /义务兵征集|优待安置|兵役.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '兵役',
  },
  // 地方性法规 - 联系人大代表
  {
    pattern: /联系人大代表|代表.*联系办法/,
    category: LawCategory.PROCEDURE,
    description: '代表联系',
  },
  // 地方性法规 - 渎职侵权检察
  {
    pattern: /渎职侵权.*检察|检察工作.*决议/,
    category: LawCategory.PROCEDURE,
    description: '检察工作',
  },
  // 地方性法规 - 合同格式条款
  {
    pattern: /合同格式条款|格式条款监督/,
    category: LawCategory.ECONOMIC,
    description: '合同格式',
  },
  // 地方性法规 - 资源综合利用
  {
    pattern: /资源综合利用|综合利用.*管理/,
    category: LawCategory.ECONOMIC,
    description: '资源利用',
  },
  // 地方性法规 - 劳动力市场
  {
    pattern: /劳动力市场|人才市场.*管理/,
    category: LawCategory.LABOR,
    description: '劳动力',
  },
  // 地方性法规 - 献血法实施
  {
    pattern: /献血法.*实施|献血法.*办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '献血法',
  },
  // 地方性法规 - 发展中医
  {
    pattern: /发展中医|中医.*条例/,
    category: LawCategory.ECONOMIC,
    description: '中医',
  },
  // 地方性法规 - 办理代表建议
  {
    pattern: /办理.*代表建议|代表建议.*办法/,
    category: LawCategory.PROCEDURE,
    description: '代表建议',
  },
  // 地方性法规 - 禁止开山采石
  {
    pattern: /禁止开山采石|开山采石.*条例/,
    category: LawCategory.ECONOMIC,
    description: '禁止采石',
  },
  // 地方性法规 - 执法违法责任追究
  {
    pattern: /执法违法责任追究|违法办案责任/,
    category: LawCategory.ADMINISTRATIVE,
    description: '责任追究',
  },
  // 地方性法规 - 地震安全性评价
  {
    pattern: /地震安全性评价|地震.*评价/,
    category: LawCategory.ECONOMIC,
    description: '地震安全',
  },
  // 地方性法规 - 住房公积金
  {
    pattern: /住房公积金.*管理|公积金.*办法/,
    category: LawCategory.ECONOMIC,
    description: '公积金',
  },
  // 地方性法规 - 执法责任制
  {
    pattern: /执法责任制|执法.*责任/,
    category: LawCategory.ADMINISTRATIVE,
    description: '执法责任',
  },
  // 地方性法规 - 城市客运出租
  {
    pattern: /城市客运.*出租汽车|出租车.*管理/,
    category: LawCategory.ECONOMIC,
    description: '出租车',
  },
  // 地方性法规 - 人大代表议案
  {
    pattern: /人大代表议案处理|议案.*程序/,
    category: LawCategory.PROCEDURE,
    description: '代表议案',
  },
  // 地方性法规 - 生态省建设
  {
    pattern: /生态省建设|生态.*规划/,
    category: LawCategory.ECONOMIC,
    description: '生态建设',
  },
  // 地方性法规 - 预算审批监督
  {
    pattern: /预算审批监督|预算.*监督条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '预算监督',
  },
  // 地方性法规 - 人大专门委员会
  {
    pattern: /人民代表大会专门委员会|专门委员会.*条例/,
    category: LawCategory.PROCEDURE,
    description: '专门委员会',
  },
  // 地方性法规 - 城市居民委员会组织法
  {
    pattern: /城市居民委员会组织法.*实施|居民委员会.*办法/,
    category: LawCategory.PROCEDURE,
    description: '居委会',
  },
  // 地方性法规 - 保护人大代表人身自由
  {
    pattern: /保护.*人大代表人身自由|代表人身自由/,
    category: LawCategory.PROCEDURE,
    description: '代表保护',
  },
  // 地方性法规 - 粘土砖瓦生产用地
  {
    pattern: /粘土砖瓦|砖瓦生产/,
    category: LawCategory.ECONOMIC,
    description: '砖瓦生产',
  },
  // 地方性法规 - 古树名木保护
  {
    pattern: /古树名木.*条例|古树名木.*保护/,
    category: LawCategory.ECONOMIC,
    description: '古树名木',
  },
  // 地方性法规 - 知识城/开发区
  {
    pattern: /知识城.*条例|开发区.*条例/,
    category: LawCategory.ECONOMIC,
    description: '知识城',
  },
  // 地方性法规 - 行政许可监督
  {
    pattern: /行政许可监督管理|许可监督/,
    category: LawCategory.ADMINISTRATIVE,
    description: '许可监督',
  },
  // 地方性法规 - 先进制造业
  {
    pattern: /先进制造业|制造业促进/,
    category: LawCategory.ECONOMIC,
    description: '先进制造',
  },
  // 地方性法规 - 街道工作委员会
  {
    pattern: /街道工作委员会|街道.*工作条例/,
    category: LawCategory.PROCEDURE,
    description: '街道工作',
  },
  // 地方性法规 - 反间谍安全防范
  {
    pattern: /反间谍安全防范|安全防范.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '安全防范',
  },
  // 地方性法规 - 智慧城市
  {
    pattern: /智慧城市.*促进|智慧城市.*条例/,
    category: LawCategory.ECONOMIC,
    description: '智慧城市',
  },
  // 地方性法规 - 非遗技艺保护
  {
    pattern: /雕刻技艺保护|技艺保护.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '技艺保护',
  },
  // 地方性法规 - 特色产品保护
  {
    pattern: /.*保护管理办法|.*花.*保护/,
    category: LawCategory.ECONOMIC,
    description: '产品保护',
  },
  // 地方性法规 - 生活垃圾管理
  {
    pattern: /生活垃圾管理|垃圾.*管理/,
    category: LawCategory.ECONOMIC,
    description: '垃圾管理',
  },
  // 地方性法规 - 黑臭水体
  {
    pattern: /黑臭水体.*防治/,
    category: LawCategory.ECONOMIC,
    description: '黑臭水体',
  },
  // 地方性法规 - 反铺张浪费
  {
    pattern: /反铺张浪费|铺张浪费.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '反浪费',
  },
  // 地方性法规 - 生活垃圾分类
  {
    pattern: /生活垃圾分类.*管理/,
    category: LawCategory.ECONOMIC,
    description: '垃圾分类',
  },
  // 地方性法规 - 灌区工程管护
  {
    pattern: /灌区.*工程管护/,
    category: LawCategory.ECONOMIC,
    description: '灌区管护',
  },
  // 地方性法规 - 家政服务
  {
    pattern: /家政服务.*条例/,
    category: LawCategory.LABOR,
    description: '家政服务',
  },
  // 地方性法规 - 河流水系保护
  {
    pattern: /.*河.*保护.*规定|.*河.*管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '河流保护',
  },
  // 地方性法规 - 污染源监控
  {
    pattern: /污染源自动监控|污染源监控/,
    category: LawCategory.ECONOMIC,
    description: '污染监控',
  },
  // 地方性法规 - 献血
  {
    pattern: /献血条例|献血.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '献血',
  },
  // 地方性法规 - 不动产登记
  {
    pattern: /不动产登记.*办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '不动产登记',
  },
  // 地方性法规 - 全民阅读
  {
    pattern: /全民阅读.*促进/,
    category: LawCategory.ADMINISTRATIVE,
    description: '全民阅读',
  },
  // 地方性法规 - 停车管理
  {
    pattern: /停车管理.*和服务|停车.*管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '停车管理',
  },
  // 地方性法规 - 公园管理
  {
    pattern: /公园.*条例|公园.*管理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '公园管理',
  },
  // 地方性法规 - 动物诊疗
  {
    pattern: /动物诊疗.*管理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '动物诊疗',
  },
  // 地方性法规 - 商品房销售
  {
    pattern: /商品房销售.*条例/,
    category: LawCategory.ECONOMIC,
    description: '商品房',
  },
  // 地方性法规 - 中小学生人身伤害
  {
    pattern: /中小学生人身伤害.*预防/,
    category: LawCategory.ADMINISTRATIVE,
    description: '学生安全',
  },
  // 地方性法规 - 平安建设
  {
    pattern: /平安建设.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '平安建设',
  },
  // 地方性法规 - 电信用户实名
  {
    pattern: /电信用户真实身份|实名信息登记/,
    category: LawCategory.ADMINISTRATIVE,
    description: '实名登记',
  },
  // 地方性法规 - 测绘管理
  {
    pattern: /测绘.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '测绘管理',
  },
  // 地方性法规 - 市容治理
  {
    pattern: /市容治理|市容.*管理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '市容治理',
  },
  // 地方性法规 - 乡村清洁
  {
    pattern: /乡村清洁.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '乡村清洁',
  },
  // 地方性法规 - 河道管理
  {
    pattern: /河道.*条例|河道.*管理/,
    category: LawCategory.ECONOMIC,
    description: '河道管理',
  },
  // 地方性法规 - 工会条例
  {
    pattern: /工会.*条例|工会.*规定/,
    category: LawCategory.LABOR,
    description: '工会',
  },
  // 地方性法规 - 涉案财物价格认定
  {
    pattern: /涉案财物价格认定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '价格认定',
  },
  // 地方性法规 - 滨水公共空间
  {
    pattern: /滨水公共空间|公共空间.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '公共空间',
  },
  // 地方性法规 - 科学仪器共享
  {
    pattern: /科学仪器设施共享|仪器共享/,
    category: LawCategory.ECONOMIC,
    description: '仪器共享',
  },
  // 地方性法规 - 水路交通
  {
    pattern: /水路交通.*条例/,
    category: LawCategory.ECONOMIC,
    description: '水路交通',
  },
  // 地方性法规 - 不可降解塑料
  {
    pattern: /不可降解塑料.*制品/,
    category: LawCategory.ECONOMIC,
    description: '塑料制品',
  },
  // 地方性法规 - 绿色食品
  {
    pattern: /绿色食品.*管理/,
    category: LawCategory.ECONOMIC,
    description: '绿色食品',
  },
  // 地方性法规 - 试车产业服务
  {
    pattern: /试车产业服务|试车.*条例/,
    category: LawCategory.ECONOMIC,
    description: '试车产业',
  },
  // 地方性法规 - 住宅交付使用许可
  {
    pattern: /住宅交付使用许可/,
    category: LawCategory.ADMINISTRATIVE,
    description: '住宅许可',
  },
  // 地方性法规 - 医疗保障
  {
    pattern: /医疗保障.*条例|医疗保障.*管理/,
    category: LawCategory.ECONOMIC,
    description: '医疗保障',
  },
  // 地方性法规 - 青年创新创业
  {
    pattern: /青年创新创业|青年.*创业促进/,
    category: LawCategory.LABOR,
    description: '青年创业',
  },
  // 地方性法规 - 集会游行示威法实施
  {
    pattern: /集会游行示威法.*实施|集会游行示威.*办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '集会示威',
  },
  // 地方性法规 - 无障碍环境
  {
    pattern: /无障碍环境.*建设/,
    category: LawCategory.ADMINISTRATIVE,
    description: '无障碍',
  },
  // 地方性法规 - 节水控水
  {
    pattern: /节水控水|节水.*管理/,
    category: LawCategory.ECONOMIC,
    description: '节水',
  },
  // 地方性法规 - 乡村人居环境
  {
    pattern: /乡村人居环境|农村人居环境/,
    category: LawCategory.ADMINISTRATIVE,
    description: '乡村环境',
  },
  // 地方性法规 - 沙化土地治理
  {
    pattern: /沙化土地.*治理/,
    category: LawCategory.ECONOMIC,
    description: '沙化治理',
  },
  // 地方性法规 - 电动车管理
  {
    pattern: /电动车.*管理|电动自行车.*管理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '电动车',
  },
  // 地方性法规 - 医疗保障基金
  {
    pattern: /医疗保障基金.*监督/,
    category: LawCategory.ECONOMIC,
    description: '医保基金',
  },
  // 地方性法规 - 网格化服务管理
  {
    pattern: /网格化服务管理|网格化.*管理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '网格化',
  },
  // 地方性法规 - 公共资源交易
  {
    pattern: /公共资源交易.*监督/,
    category: LawCategory.ADMINISTRATIVE,
    description: '公共资源',
  },
  // 地方性法规 - 气瓶安全管理
  {
    pattern: /气瓶安全管理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '气瓶安全',
  },
  // 地方性法规 - 房屋使用安全
  {
    pattern: /房屋使用安全管理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '房屋安全',
  },
  // 地方性法规 - 文明祭祀
  {
    pattern: /文明祭祀.*管理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '文明祭祀',
  },
  // 地方性法规 - 质量促进
  {
    pattern: /质量促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '质量促进',
  },
  // 地方性法规 - 工业废水管理
  {
    pattern: /工业废水.*管理|零散工业废水/,
    category: LawCategory.ECONOMIC,
    description: '工业废水',
  },
  // 地方性法规 - 天然水域垂钓
  {
    pattern: /天然水域垂钓.*管理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '垂钓管理',
  },
  // 地方性法规 - 文物保护
  {
    pattern: /文物保护.*条例|保护.*管理条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '文物保护',
  },
  // 地方性法规 - 艺术传承
  {
    pattern: /艺术传承.*发展/,
    category: LawCategory.ADMINISTRATIVE,
    description: '艺术传承',
  },
  // 地方性法规 - 整沟治理
  {
    pattern: /整沟治理.*促进/,
    category: LawCategory.ECONOMIC,
    description: '整沟治理',
  },
  // 地方性法规 - 社会保障卡一卡通
  {
    pattern: /社会保障卡.*一卡通/,
    category: LawCategory.LABOR,
    description: '社保一卡通',
  },
  // 地方性法规 - 任免工作人员
  {
    pattern: /任免国家机关工作人员.*条例/,
    category: LawCategory.PROCEDURE,
    description: '任免',
  },
  // 地方性法规 - 边境管理
  {
    pattern: /边境管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '边境管理',
  },
  // 地方性法规 - 地下空间开发
  {
    pattern: /地下空间.*开发.*利用/,
    category: LawCategory.ADMINISTRATIVE,
    description: '地下空间',
  },
  // 地方性法规 - 自然灾害应急
  {
    pattern: /自然灾害应急避险/,
    category: LawCategory.ADMINISTRATIVE,
    description: '应急避险',
  },
  // 地方性法规 - 重点开发开放试验区
  {
    pattern: /重点开发开放试验区/,
    category: LawCategory.ECONOMIC,
    description: '试验区',
  },
  // 地方性法规 - 门楼号牌
  {
    pattern: /门楼号牌.*管理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '门楼号牌',
  },
  // 地方性法规 - 病媒生物预防控制
  {
    pattern: /病媒生物预防控制/,
    category: LawCategory.ADMINISTRATIVE,
    description: '病媒生物',
  },
  // 地方性法规 - 盐业管理
  {
    pattern: /盐业.*条例|盐业.*管理/,
    category: LawCategory.ECONOMIC,
    description: '盐业',
  },
  // 地方性法规 - 民族团结进步
  {
    pattern: /民族团结进步.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '民族团结',
  },
  // 地方性法规 - 代表建议工作
  {
    pattern: /代表建议.*工作条例/,
    category: LawCategory.PROCEDURE,
    description: '代表建议',
  },
  // 地方性法规 - 沿岸建设管理
  {
    pattern: /沿岸.*建设管理/,
    category: LawCategory.ECONOMIC,
    description: '沿岸建设',
  },
  // 地方性法规 - 家庭医生签约
  {
    pattern: /家庭医生签约服务/,
    category: LawCategory.LABOR,
    description: '家庭医生',
  },
  // 地方性法规 - 代表议案
  {
    pattern: /代表议案.*条例/,
    category: LawCategory.PROCEDURE,
    description: '代表议案',
  },
  // 地方性法规 - 街道居民议事
  {
    pattern: /街道居民议事.*规定/,
    category: LawCategory.PROCEDURE,
    description: '居民议事',
  },
  // 地方性法规 - 信息基础设施
  {
    pattern: /信息基础设施.*条例/,
    category: LawCategory.ECONOMIC,
    description: '信息基础设施',
  },
  // 地方性法规 - 地理标志
  {
    pattern: /地理标志.*条例/,
    category: LawCategory.ECONOMIC,
    description: '地理标志',
  },
  // 地方性法规 - 退役军人保障
  {
    pattern: /退役军人保障.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '退役军人',
  },
  // 地方性法规 - 代表法实施
  {
    pattern: /代表法.*实施.*办法/,
    category: LawCategory.PROCEDURE,
    description: '代表法',
  },
  // 地方性法规 - 预算绩效管理
  {
    pattern: /预算绩效管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '预算绩效',
  },
  // 地方性法规 - 邮政条例
  {
    pattern: /邮政.*条例|邮政.*管理/,
    category: LawCategory.ECONOMIC,
    description: '邮政',
  },
  // 地方性法规 - 招标投标法实施
  {
    pattern: /招标投标法.*实施.*办法/,
    category: LawCategory.ECONOMIC,
    description: '招标投标法',
  },
  // 地方性法规 - 机关运行保障
  {
    pattern: /机关运行保障.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '机关保障',
  },
  // 地方性法规 - 国家安全技术保卫
  {
    pattern: /国家安全技术保卫/,
    category: LawCategory.ADMINISTRATIVE,
    description: '安全保卫',
  },
  // 地方性法规 - 商品交易市场
  {
    pattern: /商品交易市场.*管理/,
    category: LawCategory.ECONOMIC,
    description: '商品交易',
  },
  // 地方性法规 - 红十字会
  {
    pattern: /红十字会.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '红十字会',
  },
  // 地方性法规 - 民营科技企业
  {
    pattern: /民营科技企业.*条例/,
    category: LawCategory.ECONOMIC,
    description: '民营科技',
  },
  // 地方性法规 - 国家通用语言文字法实施
  {
    pattern: /国家通用语言文字法.*实施/,
    category: LawCategory.ADMINISTRATIVE,
    description: '语言文字',
  },
  // 地方性法规 - 环境噪声
  {
    pattern: /环境噪声.*管理/,
    category: LawCategory.ECONOMIC,
    description: '环境噪声',
  },
  // 地方性法规 - 资源节约
  {
    pattern: /资源节约.*条例/,
    category: LawCategory.ECONOMIC,
    description: '资源节约',
  },
  // 地方性法规 - 预防职务犯罪
  {
    pattern: /预防职务犯罪.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '职务犯罪',
  },
  // 地方性法规 - 集市贸易
  {
    pattern: /集市贸易.*管理/,
    category: LawCategory.ECONOMIC,
    description: '集市贸易',
  },
  // 地方性法规 - 供用电
  {
    pattern: /供用电.*条例/,
    category: LawCategory.ECONOMIC,
    description: '供用电',
  },
  // 地方性法规 - 信用建设
  {
    pattern: /信用建设.*决定/,
    category: LawCategory.ECONOMIC,
    description: '信用建设',
  },
  // 地方性法规 - 种子法实施
  {
    pattern: /种子法.*实施.*办法/,
    category: LawCategory.ECONOMIC,
    description: '种子法',
  },
  // 地方性法规 - 暂住人口管理
  {
    pattern: /暂住人口.*管理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '暂住人口',
  },
  // 地方性法规 - 农药经营使用
  {
    pattern: /农药经营使用.*管理/,
    category: LawCategory.ECONOMIC,
    description: '农药',
  },
  // 地方性法规 - 合同监督
  {
    pattern: /合同监督.*条例/,
    category: LawCategory.ECONOMIC,
    description: '合同监督',
  },
  // 地方性法规 - 立法听证
  {
    pattern: /立法听证.*条例/,
    category: LawCategory.PROCEDURE,
    description: '立法听证',
  },
  // 地方性法规 - 安全技术防范
  {
    pattern: /安全技术防范.*管理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '技术防范',
  },
  // 地方性法规 - 禁止鉴定胎儿性别
  {
    pattern: /禁止.*鉴定胎儿性别|选择性别终止妊娠/,
    category: LawCategory.ADMINISTRATIVE,
    description: '性别鉴定',
  },
  // 地方性法规 - 民兵预备役
  {
    pattern: /民兵预备役.*工作/,
    category: LawCategory.ADMINISTRATIVE,
    description: '民兵预备役',
  },
  // 地方性法规 - 公民旁听
  {
    pattern: /公民旁听.*办法/,
    category: LawCategory.PROCEDURE,
    description: '公民旁听',
  },
  // 地方性法规 - 国有土地使用权出让
  {
    pattern: /国有土地使用权出让.*条例/,
    category: LawCategory.ECONOMIC,
    description: '土地使用权',
  },
  // 地方性法规 - 城市道路管理
  {
    pattern: /城市道路.*管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '道路管理',
  },
  // 地方性法规 - 失业保险
  {
    pattern: /失业保险.*条例/,
    category: LawCategory.LABOR,
    description: '失业保险',
  },
  // 地方性法规 - 国有土地有偿使用
  {
    pattern: /国有土地有偿使用.*条例/,
    category: LawCategory.ECONOMIC,
    description: '土地有偿',
  },
  // 地方性法规 - 房屋权属登记
  {
    pattern: /房屋权属登记.*管理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '权属登记',
  },
  // 地方性法规 - 传染病防控
  {
    pattern: /预防控制.*肺炎|传染病.*预防/,
    category: LawCategory.ADMINISTRATIVE,
    description: '传染病',
  },
  // 地方性法规 - 企业负担监督
  {
    pattern: /企业负担监督管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '企业负担',
  },
  // 地方性法规 - 罚没财物管理
  {
    pattern: /罚没和扣押财物.*管理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '罚没财物',
  },
  // 地方性法规 - 职业训练
  {
    pattern: /职业训练.*条例/,
    category: LawCategory.LABOR,
    description: '职业训练',
  },
  // 地方性法规 - 荣誉公民称号
  {
    pattern: /荣誉公民称号.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '荣誉公民',
  },
  // 地方性法规 - 政府投资项目
  {
    pattern: /政府投资项目.*管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '政府投资',
  },
  // 地方性法规 - 招标投标法实施
  {
    pattern: /招标投标法.*实施办法/,
    category: LawCategory.ECONOMIC,
    description: '招标投标',
  },
  // 地方性法规 - 地质环境管理
  {
    pattern: /地质环境.*管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '地质环境',
  },
  // 地方性法规 - 代表建议办理
  {
    pattern: /代表建议.*办理.*规定/,
    category: LawCategory.PROCEDURE,
    description: '代表建议',
  },
  // 地方性法规 - 遗体捐献
  {
    pattern: /遗体捐献.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '遗体捐献',
  },
  // 地方性法规 - 土地登记
  {
    pattern: /土地登记.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '土地登记',
  },
  // 地方性法规 - 重点项目稽察
  {
    pattern: /重点项目稽察.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '项目稽察',
  },
  // 地方性法规 - 房屋拆迁管理
  {
    pattern: /房屋拆迁.*管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '房屋拆迁',
  },
  // 地方性法规 - 酒类专卖管理
  {
    pattern: /酒类专卖.*管理/,
    category: LawCategory.ECONOMIC,
    description: '酒类专卖',
  },
  // 地方性法规 - 生态公益林
  {
    pattern: /生态公益林.*条例/,
    category: LawCategory.ECONOMIC,
    description: '生态公益林',
  },
  // 地方性法规 - 人工增雨防雹
  {
    pattern: /人工增雨防雹.*管理/,
    category: LawCategory.ECONOMIC,
    description: '增雨防雹',
  },
  // 地方性法规 - 乱收费
  {
    pattern: /禁止.*乱收费|乱罚款.*各种摊派/,
    category: LawCategory.ADMINISTRATIVE,
    description: '乱收费',
  },
  // 地方性法规 - 厂务公开
  {
    pattern: /厂务公开.*条例/,
    category: LawCategory.LABOR,
    description: '厂务公开',
  },
  // 地方性法规 - 道路旅客运输
  {
    pattern: /道路旅客运输.*管理/,
    category: LawCategory.ECONOMIC,
    description: '道路运输',
  },
  // 地方性法规 - 矿山安全法实施
  {
    pattern: /矿山安全法.*实施.*办法/,
    category: LawCategory.ECONOMIC,
    description: '矿山安全',
  },
  // 地方性法规 - 内部治安保卫
  {
    pattern: /内部治安保卫.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '治安保卫',
  },
  // 地方性法规 - 听证
  {
    pattern: /听证.*条例|听证.*规定/,
    category: LawCategory.PROCEDURE,
    description: '听证',
  },
  // 地方性法规 - 科技成果转化
  {
    pattern: /科技成果作价|科技成果转化/,
    category: LawCategory.ECONOMIC,
    description: '科技成果',
  },
  // 地方性法规 - 植物检疫
  {
    pattern: /植物检疫.*条例/,
    category: LawCategory.ECONOMIC,
    description: '植物检疫',
  },
  // 地方性法规 - 船舶污染防治
  {
    pattern: /防治船舶污染.*水域/,
    category: LawCategory.ECONOMIC,
    description: '船舶污染',
  },
  // 地方性法规 - 开山采石限制
  {
    pattern: /限制开山采石|开山采石.*决定/,
    category: LawCategory.ECONOMIC,
    description: '采石限制',
  },
  // 地方性法规 - 国民经济计划审查
  {
    pattern: /审查.*国民经济和社会发展计划/,
    category: LawCategory.PROCEDURE,
    description: '计划审查',
  },
  // 地方性法规 - 流动人口计划生育
  {
    pattern: /流动人口.*计划生育/,
    category: LawCategory.ADMINISTRATIVE,
    description: '流动人口',
  },
  // 地方性法规 - 非公有制企业权益
  {
    pattern: /非公有制企业.*权益保障/,
    category: LawCategory.ECONOMIC,
    description: '非公企业',
  },
  // 地方性法规 - 法规制定程序
  {
    pattern: /地方性法规制定程序/,
    category: LawCategory.PROCEDURE,
    description: '制定程序',
  },
  // 地方性法规 - 法律法规执行检查监督
  {
    pattern: /法律法规执行情况检查监督/,
    category: LawCategory.PROCEDURE,
    description: '执法监督',
  },
  // 地方性法规 - 处理质询案
  {
    pattern: /处理质询案.*规定/,
    category: LawCategory.PROCEDURE,
    description: '质询案',
  },
  // 地方性法规 - 无公害农产品
  {
    pattern: /无公害.*保护管理|无公害.*规定/,
    category: LawCategory.ECONOMIC,
    description: '无公害',
  },
  // 地方性法规 - 油区管理
  {
    pattern: /油区.*管理.*规定/,
    category: LawCategory.ECONOMIC,
    description: '油区管理',
  },
  // 地方性法规 - 村集体财务管理
  {
    pattern: /村集体财务管理.*条例/,
    category: LawCategory.PROCEDURE,
    description: '村财务',
  },
  // 地方性法规 - 档案征集
  {
    pattern: /档案征集.*条例/,
    category: LawCategory.PROCEDURE,
    description: '档案征集',
  },
  // 地方性法规 - 文物保护
  {
    pattern: /纪念地.*保护.*管理|遗址.*保护.*管理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '文物保护',
  },
  // 地方性法规 - 联系代表办法
  {
    pattern: /联系.*人民代表大会.*办法/,
    category: LawCategory.PROCEDURE,
    description: '联系代表',
  },
  // 地方性法规 - 兵役工作
  {
    pattern: /兵役工作.*规定|兵役.*若干规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '兵役工作',
  },
  // 地方性法规 - 城市快速路路政
  {
    pattern: /城市快速路路政.*管理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '路政管理',
  },
  // 地方性法规 - 军事设施保护法
  {
    pattern: /军事设施保护法.*实施.*办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '军事设施',
  },
  // 地方性法规 - 统计监督检查
  {
    pattern: /统计监督检查.*条例|统计检查监督/,
    category: LawCategory.ADMINISTRATIVE,
    description: '统计监督',
  },
  // 地方性法规 - 江河管理条例
  {
    pattern: /.*江.*管理条例|.*江.*管理办法/,
    category: LawCategory.ECONOMIC,
    description: '江河管理',
  },
  // 地方性法规 - 取缔无照经营
  {
    pattern: /取缔无照经营.*条例/,
    category: LawCategory.ECONOMIC,
    description: '无照经营',
  },
  // 地方性法规 - 收费罚款财物管理
  {
    pattern: /收费罚款.*没收财物.*管理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '收费财物',
  },
  // 地方性法规 - 外商投资财产鉴定
  {
    pattern: /外商投资财产.*价值鉴定/,
    category: LawCategory.ECONOMIC,
    description: '外资鉴定',
  },
  // 地方性法规 - 小流域治理
  {
    pattern: /小流域.*开发治理/,
    category: LawCategory.ECONOMIC,
    description: '小流域',
  },
  // 地方性法规 - 性病防治管理
  {
    pattern: /性病防治.*管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '性病防治',
  },
  // 地方性法规 - 反不正当竞争
  {
    pattern: /反不正当竞争.*条例/,
    category: LawCategory.ECONOMIC,
    description: '反不正当竞争',
  },
  // 地方性法规 - 村镇规划建设
  {
    pattern: /村镇规划建设.*管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '村镇规划',
  },
  // 地方性法规 - 城市市政设施
  {
    pattern: /城市市政设施.*管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '市政设施',
  },
  // 地方性法规 - 房屋居住权
  {
    pattern: /房屋居住权.*处理办法/,
    category: LawCategory.CIVIL,
    description: '居住权',
  },
  // 地方性法规 - 预算外资金
  {
    pattern: /预算外资金.*管理.*办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '预算外资金',
  },
  // 地方性法规 - 土地权属
  {
    pattern: /确认土地权属.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '土地权属',
  },
  // 地方性法规 - 气象规定
  {
    pattern: /气象.*管理规定|气象.*办法/,
    category: LawCategory.ECONOMIC,
    description: '气象',
  },
  // 地方性法规 - 供销合作社
  {
    pattern: /供销合作社.*条例/,
    category: LawCategory.ECONOMIC,
    description: '供销社',
  },
  // 地方性法规 - 体育法实施
  {
    pattern: /体育法.*实施办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '体育法',
  },
  // 地方性法规 - 个体私营经济
  {
    pattern: /个体工商户.*私营企业.*条例/,
    category: LawCategory.ECONOMIC,
    description: '个体私营',
  },
  // 地方性法规 - 矿山安全法实施
  {
    pattern: /矿山安全法.*实施办法/,
    category: LawCategory.ECONOMIC,
    description: '矿山安全',
  },
  // 地方性法规 - 体育
  {
    pattern: /体育条例|体育市场管理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '体育',
  },
  // 地方性法规 - 职业病防治
  {
    pattern: /职业病防治.*条例/,
    category: LawCategory.ECONOMIC,
    description: '职业病',
  },
  // 地方性法规 - 语言文字法实施
  {
    pattern: /国家通用语言文字法.*实施办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '语言文字',
  },
  // 地方性法规 - 广告法实施
  {
    pattern: /广告法.*实施办法/,
    category: LawCategory.ECONOMIC,
    description: '广告法',
  },
  // 地方性法规 - 耕地保养
  {
    pattern: /耕地保养.*条例/,
    category: LawCategory.ECONOMIC,
    description: '耕地',
  },
  // 地方性法规 - 采煤塌陷地复垦
  {
    pattern: /采煤塌陷地复垦.*条例/,
    category: LawCategory.ECONOMIC,
    description: '塌陷地',
  },
  // 地方性法规 - 职业介绍
  {
    pattern: /职业介绍.*条例/,
    category: LawCategory.LABOR,
    description: '职业介绍',
  },
  // 地方性法规 - 房屋权属登记
  {
    pattern: /房屋权属登记.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '权属登记',
  },
  // 地方性法规 - 房产管理
  {
    pattern: /城市房产管理.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '房产管理',
  },
  // 地方性法规 - 测绘法实施
  {
    pattern: /测绘法.*实施办法/,
    category: LawCategory.ECONOMIC,
    description: '测绘法',
  },
  // 地方性法规 - 重点项目稽察
  {
    pattern: /重点建设项目稽察.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '稽察',
  },
  // 地方性法规 - 国有林场
  {
    pattern: /国有林场.*条例/,
    category: LawCategory.ECONOMIC,
    description: '国有林场',
  },
  // 地方性法规 - 口岸管理
  {
    pattern: /口岸综合管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '口岸',
  },
  // 地方性法规 - 禁止采砂
  {
    pattern: /严禁.*采砂|非法采砂.*决定/,
    category: LawCategory.ECONOMIC,
    description: '禁止采砂',
  },
  // 地方性法规 - 遗体角膜捐献
  {
    pattern: /捐献.*遗体|捐献.*角膜/,
    category: LawCategory.ADMINISTRATIVE,
    description: '器官捐献',
  },
  // 地方性法规 - 藏语文
  {
    pattern: /藏语文.*规定|藏语文.*发展/,
    category: LawCategory.ADMINISTRATIVE,
    description: '藏语文',
  },
  // 地方性法规 - 水路货物运输
  {
    pattern: /水路货物运输.*管理.*规定/,
    category: LawCategory.ECONOMIC,
    description: '货运',
  },
  // 地方性法规 - 滩涂围垦
  {
    pattern: /沿海滩涂围垦.*办法/,
    category: LawCategory.ECONOMIC,
    description: '滩涂',
  },
  // 地方性法规 - 渔工劳务合作
  {
    pattern: /渔工劳务合作.*办法/,
    category: LawCategory.ECONOMIC,
    description: '劳务合作',
  },
  // 地方性法规 - 公民举报权利
  {
    pattern: /保护.*公民举报权利/,
    category: LawCategory.ADMINISTRATIVE,
    description: '举报权利',
  },
  // 地方性法规 - 乡镇企业
  {
    pattern: /乡镇企业.*条例/,
    category: LawCategory.ECONOMIC,
    description: '乡镇企业',
  },
  // 地方性法规 - 扫除文盲
  {
    pattern: /扫除文盲.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '扫盲',
  },
  // 地方性法规 - 中小企业促进法实施
  {
    pattern: /中小企业促进法.*实施办法/,
    category: LawCategory.ECONOMIC,
    description: '中小企业',
  },
  // 地方性法规 - 垃圾处理设施选址
  {
    pattern: /垃圾集中处理设施.*选址/,
    category: LawCategory.ADMINISTRATIVE,
    description: '垃圾设施',
  },
  // 地方性法规 - 农药管理
  {
    pattern: /禁用限用.*农药|剧毒高毒农药/,
    category: LawCategory.ECONOMIC,
    description: '农药',
  },
  // 地方性法规 - 行政事业性收费
  {
    pattern: /行政事业性收费.*管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '收费管理',
  },
  // 地方性法规 - 收据管理
  {
    pattern: /收据.*管理办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '收据',
  },
  // 地方性法规 - 城区道路管理
  {
    pattern: /城区道路.*管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '道路管理',
  },
  // 地方性法规 - 食品小作坊管理
  {
    pattern: /食品小作坊.*管理.*条例|食品摊贩.*管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '食品管理',
  },
  // 地方性法规 - 妇女权益保障
  {
    pattern: /妇女权益保障.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '妇女权益',
  },
  // 地方性法规 - 社会科学普及
  {
    pattern: /社会科学普及.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '社科普及',
  },
  // 地方性法规 - 食品安全
  {
    pattern: /食品安全.*条例/,
    category: LawCategory.ECONOMIC,
    description: '食品安全',
  },
  // 地方性法规 - 超限超载治理
  {
    pattern: /超限超载治理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '超限超载',
  },
  // 地方性法规 - 检验检测
  {
    pattern: /检验检测.*条例/,
    category: LawCategory.ECONOMIC,
    description: '检验检测',
  },
  // 地方性法规 - 地方性法规制定
  {
    pattern: /地方性法规制定.*办法|地方性法规制定.*条例/,
    category: LawCategory.PROCEDURE,
    description: '法规制定',
  },
  // 地方性法规 - 房屋安全管理
  {
    pattern: /房屋安全管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '房屋安全',
  },
  // 地方性法规 - 选举法细则
  {
    pattern: /选举法.*细则/,
    category: LawCategory.PROCEDURE,
    description: '选举法',
  },
  // 地方性法规 - 扶贫
  {
    pattern: /大扶贫.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '扶贫',
  },
  // 地方性法规 - 乡镇人大工作
  {
    pattern: /乡镇人民代表大会工作.*条例/,
    category: LawCategory.PROCEDURE,
    description: '乡镇人大',
  },
  // 地方性法规 - 公共体育场馆
  {
    pattern: /公共体育场馆.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '体育场馆',
  },
  // 地方性法规 - 街道办事处
  {
    pattern: /街道办事处.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '街道办',
  },
  // 地方性法规 - 流动人口服务管理
  {
    pattern: /流动人口服务和管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '流动人口',
  },
  // 地方性法规 - 基本生态控制线
  {
    pattern: /基本生态控制线.*管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '生态控制线',
  },
  // 地方性法规 - 秸秆综合利用
  {
    pattern: /农作物秸秆综合利用.*条例/,
    category: LawCategory.ECONOMIC,
    description: '秸秆',
  },
  // 地方性法规 - 公共信用信息
  {
    pattern: /公共信用信息.*条例/,
    category: LawCategory.ECONOMIC,
    description: '信用信息',
  },
  // 地方性法规 - 乡村环境保护
  {
    pattern: /乡村环境保护和治理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '乡村环境',
  },
  // 地方性法规 - 急救医疗服务
  {
    pattern: /急救医疗服务.*条例/,
    category: LawCategory.ECONOMIC,
    description: '急救医疗',
  },
  // 地方性法规 - 城市管线管理
  {
    pattern: /城市管线.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '管线',
  },
  // 地方性法规 - 物业服务管理
  {
    pattern: /物业服务和管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '物业',
  },
  // 地方性法规 - 自主创新促进
  {
    pattern: /自主创新促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '自主创新',
  },
  // 地方性法规 - 循环经济
  {
    pattern: /循环经济.*条例/,
    category: LawCategory.ECONOMIC,
    description: '循环经济',
  },
  // 地方性法规 - 国际航运中心
  {
    pattern: /国际航运中心.*建设.*条例/,
    category: LawCategory.ECONOMIC,
    description: '航运中心',
  },
  // 地方性法规 - 水库管理
  {
    pattern: /水库管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '水库',
  },
  // 地方性法规 - 人民代表大会代表选举
  {
    pattern: /人民代表大会代表选举.*条例/,
    category: LawCategory.PROCEDURE,
    description: '代表选举',
  },
  // 地方性法规 - 市政设施管理
  {
    pattern: /市政设施管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '市政设施',
  },
  // 地方性法规 - 体育经营活动管理
  {
    pattern: /体育经营活动.*管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '体育经营',
  },
  // 地方性法规 - 社会力量参与救灾
  {
    pattern: /社会力量参与救灾.*促进/,
    category: LawCategory.ADMINISTRATIVE,
    description: '救灾',
  },
  // 地方性法规 - 统计监督管理
  {
    pattern: /统计监督管理.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '统计监督',
  },
  // 地方性法规 - 全面建成小康社会
  {
    pattern: /全面建成小康社会|现代化建设.*决议/,
    category: LawCategory.ADMINISTRATIVE,
    description: '小康社会',
  },
  // 地方性法规 - 养老机构
  {
    pattern: /养老机构.*条例/,
    category: LawCategory.LABOR,
    description: '养老机构',
  },
  // 地方性法规 - 自主创新示范区
  {
    pattern: /自主创新示范区.*条例/,
    category: LawCategory.ECONOMIC,
    description: '示范区',
  },
  // 地方性法规 - 国土保护和治理
  {
    pattern: /国土保护和治理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '国土',
  },
  // 地方性法规 - 规范行政许可
  {
    pattern: /规范行政许可.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '行政许可',
  },
  // 地方性法规 - 建设工程抗震设防
  {
    pattern: /建设工程抗震.*条例|抗震设防.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '抗震',
  },
  // 地方性法规 - 安全技术防范
  {
    pattern: /安全技术防范.*条例|技术防范.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '技术防范',
  },
  // 地方性法规 - 体育法实施
  {
    pattern: /体育法.*实施办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '体育法',
  },
  // 地方性法规 - 公共安全技术防范
  {
    pattern: /公共安全技术防范.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '公共安全',
  },
  // 地方性法规 - 全民阅读
  {
    pattern: /促进全民阅读.*决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '全民阅读',
  },
  // 地方性法规 - 房屋使用安全
  {
    pattern: /房屋使用安全.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '房屋安全',
  },
  // 地方性法规 - 房屋征收与补偿
  {
    pattern: /房屋征收与补偿.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '征收补偿',
  },
  // 地方性法规 - 资源管理
  {
    pattern: /资源管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '资源',
  },
  // 地方性法规 - 社会养老保险
  {
    pattern: /社会养老保险.*条例/,
    category: LawCategory.LABOR,
    description: '养老保险',
  },
  // 地方性法规 - 法规案表决
  {
    pattern: /法规案.*单独表决.*决定/,
    category: LawCategory.PROCEDURE,
    description: '表决',
  },
  // 地方性法规 - 行政许可条例
  {
    pattern: /行政许可条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '行政许可',
  },
  // 地方性法规 - 港澳同胞投资
  {
    pattern: /保护和促进.*港澳同胞投资/,
    category: LawCategory.ECONOMIC,
    description: '港澳投资',
  },
  // 地方性法规 - 土地整治
  {
    pattern: /土地整治.*条例/,
    category: LawCategory.ECONOMIC,
    description: '土地整治',
  },
  // 地方性法规 - 海上交通安全
  {
    pattern: /海上交通安全.*条例/,
    category: LawCategory.ECONOMIC,
    description: '海上交通',
  },
  // 地方性法规 - 军人抚恤优待
  {
    pattern: /军人抚恤优待.*办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '抚恤优待',
  },
  // 地方性法规 - 军事设施保护
  {
    pattern: /军事设施保护.*办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '军事设施',
  },
  // 地方性法规 - 交通建设管理
  {
    pattern: /交通建设管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '交通建设',
  },
  // 地方性法规 - 维修服务
  {
    pattern: /维修服务.*条例/,
    category: LawCategory.ECONOMIC,
    description: '维修服务',
  },
  // 地方性法规 - 侨属企业
  {
    pattern: /侨属企业.*条例/,
    category: LawCategory.ECONOMIC,
    description: '侨属企业',
  },
  // 地方性法规 - 木材流通管理
  {
    pattern: /木材流通管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '木材',
  },
  // 地方性法规 - 商业网点建设管理
  {
    pattern: /商业网点建设管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '商业网点',
  },
  // 地方性法规 - 分洪区安全管理
  {
    pattern: /分洪区安全.*管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '分洪区',
  },
  // 地方性法规 - 人体器官捐献
  {
    pattern: /人体器官捐献.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '器官捐献',
  },
  // 地方性法规 - 股份合作企业
  {
    pattern: /股份合作企业.*条例/,
    category: LawCategory.ECONOMIC,
    description: '股份合作',
  },
  // 地方性法规 - 保护公民举报
  {
    pattern: /保护公民举报.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '举报保护',
  },
  // 地方性法规 - 商品房预售管理
  {
    pattern: /商品房预售管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '预售管理',
  },
  // 地方性法规 - 建设工程项目行政许可
  {
    pattern: /建设工程项目.*行政许可.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '项目许可',
  },
  // 地方性法规 - 土地权属纠纷处理
  {
    pattern: /土地权属纠纷处理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '纠纷处理',
  },
  // 地方性法规 - 查处无照经营
  {
    pattern: /查处无照经营.*条例/,
    category: LawCategory.ECONOMIC,
    description: '查处无照',
  },
  // 地方性法规 - 高危险性体育项目
  {
    pattern: /高危险性体育项目.*管理.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '高危体育',
  },
  // 地方性法规 - 粮食安全保障
  {
    pattern: /粮食安全保障.*条例/,
    category: LawCategory.ECONOMIC,
    description: '粮食安全',
  },
  // 地方性法规 - 清除冰雪
  {
    pattern: /清除冰雪.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '清除冰雪',
  },
  // 地方性法规 - 社会保障性住房
  {
    pattern: /社会保障性住房.*条例/,
    category: LawCategory.ECONOMIC,
    description: '保障房',
  },
  // 地方性法规 - 美好生活
  {
    pattern: /美好生活.*决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '美好生活',
  },
  // 地方性法规 - 地方水电管理
  {
    pattern: /地方水电管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '水电',
  },
  // 地方性法规 - 合作创新区
  {
    pattern: /合作创新区.*条例/,
    category: LawCategory.ECONOMIC,
    description: '合作创新区',
  },
  // 地方性法规 - 重大事项讨论决定
  {
    pattern: /讨论.*决定重大事项.*规定/,
    category: LawCategory.PROCEDURE,
    description: '重大事项',
  },
  // 地方性法规 - 中小企业促进
  {
    pattern: /中小企业促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '中小企业',
  },
  // 地方性法规 - 动物疫病区建设
  {
    pattern: /无规定动物疫病区.*建设.*管理/,
    category: LawCategory.ECONOMIC,
    description: '动物疫病',
  },
  // 地方性法规 - 菜传承产业促进
  {
    pattern: /.*菜传承.*发展.*条例|.*菜传承与产业促进/,
    category: LawCategory.ADMINISTRATIVE,
    description: '地方菜',
  },
  // 地方性法规 - 燃气安全管理
  {
    pattern: /燃气安全管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '燃气安全',
  },
  // 地方性法规 - 特色食品传承
  {
    pattern: /地方特色食品传承.*发展/,
    category: LawCategory.ADMINISTRATIVE,
    description: '特色食品',
  },
  // 地方性法规 - 城市安全发展
  {
    pattern: /城市安全发展.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '城市安全',
  },
  // 地方性法规 - 慈善促进
  {
    pattern: /慈善.*促进.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '慈善',
  },
  // 地方性法规 - 品牌促进
  {
    pattern: /.*品牌促进.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '品牌促进',
  },
  // 地方性法规 - 价格监督检查
  {
    pattern: /价格监督检查.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '价格监督',
  },
  // 地方性法规 - 航空港实验区
  {
    pattern: /航空港经济综合实验区.*条例/,
    category: LawCategory.ECONOMIC,
    description: '航空港',
  },
  // 地方性法规 - 禁止胎儿性别鉴定
  {
    pattern: /禁止.*胎儿性别鉴定|选择性别人工终止妊娠/,
    category: LawCategory.ADMINISTRATIVE,
    description: '性别鉴定',
  },
  // 地方性法规 - 节水
  {
    pattern: /节水.*条例/,
    category: LawCategory.ECONOMIC,
    description: '节水',
  },
  // 地方性法规 - 山茶油发展
  {
    pattern: /山茶油.*发展.*条例/,
    category: LawCategory.ECONOMIC,
    description: '山茶油',
  },
  // 地方性法规 - 海上搜寻救助
  {
    pattern: /海上搜寻救助.*条例/,
    category: LawCategory.ECONOMIC,
    description: '海上救助',
  },
  // 地方性法规 - 住房租赁
  {
    pattern: /住房租赁.*条例/,
    category: LawCategory.ECONOMIC,
    description: '住房租赁',
  },
  // 地方性法规 - 城市客运规范
  {
    pattern: /规范城市客运.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '客运规范',
  },
  // 地方性法规 - 会展业促进
  {
    pattern: /会展业促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '会展业',
  },
  // 地方性法规 - 灾害预警响应
  {
    pattern: /灾害.*预警与响应.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '灾害预警',
  },
  // 地方性法规 - 进口博览会
  {
    pattern: /进口博览会.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '进口博览',
  },
  // 地方性法规 - 基层群众自治
  {
    pattern: /基层群众性自治组织.*管理.*规定/,
    category: LawCategory.PROCEDURE,
    description: '基层自治',
  },
  // 地方性法规 - 治理超限超载
  {
    pattern: /治理.*超限超载.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '超限超载',
  },
  // 地方性法规 - 残疾预防康复
  {
    pattern: /残疾预防和残疾人康复.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '残疾康复',
  },
  // 地方性法规 - 制止价格欺诈
  {
    pattern: /制止价格欺诈.*条例/,
    category: LawCategory.ECONOMIC,
    description: '价格欺诈',
  },
  // 地方性法规 - 秸秆禁烧利用
  {
    pattern: /秸秆露天禁烧和利用.*条例/,
    category: LawCategory.ECONOMIC,
    description: '秸秆',
  },
  // 地方性法规 - 出租汽车客运
  {
    pattern: /出租汽车客运.*管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '出租汽车',
  },
  // 地方性法规 - 住宅专项维修资金
  {
    pattern: /住宅专项维修资金.*管理办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '维修资金',
  },
  // 地方性法规 - 体育发展
  {
    pattern: /体育发展.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '体育发展',
  },
  // 地方性法规 - 加装电梯
  {
    pattern: /加装电梯.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '加装电梯',
  },
  // 地方性法规 - 极端天气应对
  {
    pattern: /极端天气应对.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '极端天气',
  },
  // 地方性法规 - 自建房安全
  {
    pattern: /经营性自建房.*安全管理/,
    category: LawCategory.ADMINISTRATIVE,
    description: '自建房',
  },
  // 地方性法规 - 残疾人合法权益
  {
    pattern: /残疾人合法权益.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '残疾人',
  },
  // 地方性法规 - 乡村绿美
  {
    pattern: /乡村绿美.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '乡村绿美',
  },
  // 地方性法规 - 人大监督条例
  {
    pattern: /人民代表大会常务委员会监督条例/,
    category: LawCategory.PROCEDURE,
    description: '人大监督',
  },
  // 地方性法规 - 森林条例
  {
    pattern: /森林条例/,
    category: LawCategory.ECONOMIC,
    description: '森林',
  },
  // 地方性法规 - 监督法实施
  {
    pattern: /监督法.*实施办法/,
    category: LawCategory.PROCEDURE,
    description: '监督法',
  },
  // 地方性法规 - 细胞基因产业促进
  {
    pattern: /细胞和基因产业促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '细胞基因',
  },
  // 地方性法规 - 妇女权益保障法实施
  {
    pattern: /妇女权益保障法.*实施办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '妇女权益',
  },
  // 地方性法规 - 非遗传承发展
  {
    pattern: /传承发展条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '非遗',
  },
  // 地方性法规 - 测绘条例
  {
    pattern: /测绘条例/,
    category: LawCategory.ECONOMIC,
    description: '测绘',
  },
  // 地方性法规 - 听取审议报告
  {
    pattern: /听取和审议专项工作报告.*办法/,
    category: LawCategory.PROCEDURE,
    description: '听取审议',
  },
  // 地方性法规 - 执法检查
  {
    pattern: /执法检查.*办法/,
    category: LawCategory.PROCEDURE,
    description: '执法检查',
  },
  // 地方性法规 - 代表建议办理
  {
    pattern: /代表建议.*办理.*条例/,
    category: LawCategory.PROCEDURE,
    description: '建议办理',
  },
  // 地方性法规 - 保健用品管理
  {
    pattern: /保健用品管理条例/,
    category: LawCategory.ECONOMIC,
    description: '保健用品',
  },
  // 地方性法规 - 人工影响天气
  {
    pattern: /人工影响天气.*条例/,
    category: LawCategory.ECONOMIC,
    description: '人工影响天气',
  },
  // 地方性法规 - 审查监督预算
  {
    pattern: /审查监督预算.*条例/,
    category: LawCategory.PROCEDURE,
    description: '预算监督',
  },
  // 地方性法规 - 粮食安全保障法实施
  {
    pattern: /粮食安全保障法.*实施办法/,
    category: LawCategory.ECONOMIC,
    description: '粮食安全',
  },
  // 地方性法规 - 中小学生溺水预防
  {
    pattern: /预防中小学生溺水.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '溺水预防',
  },
  // 地方性法规 - 统计条例
  {
    pattern: /统计条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '统计',
  },
  // 地方性法规 - 新就业形态劳动者
  {
    pattern: /新就业形态劳动者.*权益保障.*规定/,
    category: LawCategory.LABOR,
    description: '新就业',
  },
  // 地方性法规 - 执行地方组织法
  {
    pattern: /执行地方组织法.*若干规定/,
    category: LawCategory.PROCEDURE,
    description: '组织法',
  },
  // 地方性法规 - 城市桥梁隧道安全
  {
    pattern: /城市桥梁隧道安全管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '桥梁隧道',
  },
  // 地方性法规 - 文化遗产保护
  {
    pattern: /保护与发展条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '文化遗产',
  },
  // 地方性法规 - 租赁厂房安全
  {
    pattern: /租赁厂房安全管理.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '厂房安全',
  },
  // 地方性法规 - 城市快速路
  {
    pattern: /城市快速路.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '快速路',
  },
  // 地方性法规 - 算力产业促进
  {
    pattern: /算力产业促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '算力',
  },
  // 地方性法规 - 物业服务监督
  {
    pattern: /物业服务监督.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '物业监督',
  },
  // 地方性法规 - 再生资源回收利用
  {
    pattern: /再生资源回收利用.*条例/,
    category: LawCategory.ECONOMIC,
    description: '再生资源',
  },
  // 地方性法规 - 葡萄干质量管理
  {
    pattern: /葡萄干质量管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '葡萄干',
  },
  // 地方性法规 - 预防化解矛盾纠纷
  {
    pattern: /预防化解矛盾纠纷.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '矛盾纠纷',
  },
  // 地方性法规 - 行业协会
  {
    pattern: /行业协会.*条例/,
    category: LawCategory.ECONOMIC,
    description: '行业协会',
  },
  // 地方性法规 - 城镇社区更新
  {
    pattern: /城镇社区更新.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '社区更新',
  },
  // 地方性法规 - 重大建设项目稽察
  {
    pattern: /重大建设项目稽察.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '稽察',
  },
  // 地方性法规 - 人才市场
  {
    pattern: /人才市场.*条例/,
    category: LawCategory.LABOR,
    description: '人才市场',
  },
  // 地方性法规 - 规章备案规定
  {
    pattern: /规章备案.*规定/,
    category: LawCategory.PROCEDURE,
    description: '规章备案',
  },
  // 地方性法规 - 联系代表办法
  {
    pattern: /联系.*代表.*办法/,
    category: LawCategory.PROCEDURE,
    description: '联系代表',
  },
  // 地方性法规 - 关于议案的规定
  {
    pattern: /关于.*议案.*规定/,
    category: LawCategory.PROCEDURE,
    description: '议案',
  },
  // 地方性法规 - 代表视察办法
  {
    pattern: /代表视察.*办法/,
    category: LawCategory.PROCEDURE,
    description: '代表视察',
  },
  // 地方性法规 - 涉案财物价格鉴定
  {
    pattern: /涉案财物价格鉴定.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '价格鉴定',
  },
  // 地方性法规 - 重点工程建设
  {
    pattern: /重点工程.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '重点工程',
  },
  // 地方性法规 - 立法听证规则
  {
    pattern: /立法听证.*规则/,
    category: LawCategory.PROCEDURE,
    description: '听证规则',
  },
  // 地方性法规 - 城市公共绿地
  {
    pattern: /重点公共绿地.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '公共绿地',
  },
  // 地方性法规 - 价格管理条例
  {
    pattern: /价格管理条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '价格管理',
  },
  // 地方性法规 - 无公害蔬菜
  {
    pattern: /无公害蔬菜.*条例/,
    category: LawCategory.ECONOMIC,
    description: '无公害蔬菜',
  },
  // 地方性法规 - 客运出租汽车
  {
    pattern: /客运出租汽车.*条例/,
    category: LawCategory.ECONOMIC,
    description: '客运',
  },
  // 地方性法规 - 查处假冒伪劣商品
  {
    pattern: /查处.*假冒伪劣商品.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '假冒伪劣',
  },
  // 地方性法规 - 基础设施建设征用土地
  {
    pattern: /基础设施建设.*征用土地.*办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '征用土地',
  },
  // 地方性法规 - 森林病虫害防治检疫
  {
    pattern: /森林病虫害防治检疫.*条例/,
    category: LawCategory.ECONOMIC,
    description: '病虫害',
  },
  // 地方性法规 - 土地监督检查
  {
    pattern: /土地监督检查.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '土地监督',
  },
  // 地方性法规 - 娱乐场所管理
  {
    pattern: /娱乐场所.*管理条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '娱乐场所',
  },
  // 地方性法规 - 公共汽车电车客运
  {
    pattern: /公共汽车电车客运.*条例/,
    category: LawCategory.ECONOMIC,
    description: '公交',
  },
  // 地方性法规 - 真实身份信息登记
  {
    pattern: /真实身份信息登记.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '实名登记',
  },
  // 地方性法规 - 选举时间决定
  {
    pattern: /选举时间.*决定/,
    category: LawCategory.PROCEDURE,
    description: '选举',
  },
  // 地方性法规 - 科技兴新创新驱动
  {
    pattern: /科技兴新.*创新驱动.*决定/,
    category: LawCategory.ECONOMIC,
    description: '创新驱动',
  },
  // 地方性法规 - 加强自身建设
  {
    pattern: /加强自身建设.*决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '自身建设',
  },
  // 地方性法规 - 加强经济立法工作
  {
    pattern: /加强经济立法工作.*决议/,
    category: LawCategory.PROCEDURE,
    description: '经济立法',
  },
  // 地方性法规 - 大会议案工作
  {
    pattern: /大会议案工作.*决定/,
    category: LawCategory.PROCEDURE,
    description: '议案',
  },
  // 地方性法规 - 人大代表作用
  {
    pattern: /发挥人大代表作用.*决议/,
    category: LawCategory.PROCEDURE,
    description: '代表作用',
  },
  // 地方性法规 - 语言文字工作
  {
    pattern: /语言文字工作.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '语言文字',
  },
  // 地方性法规 - 直接选举实施细则
  {
    pattern: /直接选举.*实施细则/,
    category: LawCategory.PROCEDURE,
    description: '直接选举',
  },
  // 地方性法规 - 档案法实施
  {
    pattern: /档案法.*实施办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '档案',
  },
  // 地方性法规 - 突发事件应对法实施
  {
    pattern: /突发事件应对法.*实施办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '突发事件',
  },
  // 地方性法规 - 国土资源监督检查
  {
    pattern: /国土资源监督检查.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '国土监督',
  },
  // 地方性法规 - 发展个体私营经济
  {
    pattern: /发展个体私营经济.*条例/,
    category: LawCategory.ECONOMIC,
    description: '个体私营',
  },
  // 人大决议类 - 打击暴力犯罪
  {
    pattern: /严厉打击.*暴力犯罪.*决议/,
    category: LawCategory.CRIMINAL,
    description: '打击犯罪',
  },
  // 人大决议类 - 维护社会稳定
  {
    pattern: /维护.*社会稳定.*决议/,
    category: LawCategory.ADMINISTRATIVE,
    description: '社会稳定',
  },
  // 地方性法规 - 禁止穿戴
  {
    pattern: /禁止穿戴.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '禁止',
  },
  // 地方性法规 - 城市热力管理
  {
    pattern: /城市热力.*条例/,
    category: LawCategory.ECONOMIC,
    description: '热力',
  },
  // 地方性法规 - 预算审批监督
  {
    pattern: /预算.*审批监督.*规定/,
    category: LawCategory.PROCEDURE,
    description: '预算监督',
  },
  // 国家级法律 - 组织法
  {
    pattern: /居民委员会组织法|村民委员会组织法|人民政府组织法/,
    category: LawCategory.CIVIL,
    description: '组织法',
  },
  // 国家级法律 - 监察法
  {
    pattern: /^中华人民共和国监察法$/,
    category: LawCategory.ADMINISTRATIVE,
    description: '监察法',
  },
  // 国家级法律 - 检察官法
  {
    pattern: /^中华人民共和国检察官法$/,
    category: LawCategory.PROCEDURE,
    description: '检察官法',
  },
  // 国家级法律 - 法官法
  {
    pattern: /^中华人民共和国法官法$/,
    category: LawCategory.PROCEDURE,
    description: '法官法',
  },
  // 国家级法律 - 代表法
  {
    pattern: /全国人民代表大会和地方各级人民代表大会代表法$/,
    category: LawCategory.PROCEDURE,
    description: '代表法',
  },
  // 国家级法律 - 立法法
  {
    pattern: /^中华人民共和国立法法$/,
    category: LawCategory.PROCEDURE,
    description: '立法法',
  },
  // 国家级法律 - 国防法
  {
    pattern: /^中华人民共和国国防法$/,
    category: LawCategory.ADMINISTRATIVE,
    description: '国防法',
  },
  // 国家级法律 - 国徽法
  {
    pattern: /^中华人民共和国国徽法$/,
    category: LawCategory.ADMINISTRATIVE,
    description: '国徽法',
  },
  // 国家级法律 - 国旗法
  {
    pattern: /^中华人民共和国国旗法$/,
    category: LawCategory.ADMINISTRATIVE,
    description: '国旗法',
  },
  // 国家级法律 - 监督法
  {
    pattern: /各级人民代表大会常务委员会监督法$/,
    category: LawCategory.PROCEDURE,
    description: '监督法',
  },
  // 国家级法律 - 全国人大组织法
  {
    pattern: /全国人民代表大会组织法$/,
    category: LawCategory.PROCEDURE,
    description: '组织法',
  },
  // 试点改革类
  {
    pattern: /改革试点工作.*决定|改革试点.*决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '改革试点',
  },
  // 试点期限延长类
  {
    pattern: /试点期限.*决定|暂时调整.*期限.*决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '试点期限',
  },
  // 刑事处罚类决定
  {
    pattern: /惩治.*犯罪|严禁.*决定|拐卖.*决定/,
    category: LawCategory.CRIMINAL,
    description: '刑事决定',
  },
  // 税收犯罪类
  {
    pattern: /增值税专用发票.*决定/,
    category: LawCategory.CRIMINAL,
    description: '发票犯罪',
  },
  // 香港澳门相关
  {
    pattern: /香港特别行政区.*决定|澳门特别行政区.*决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '港澳决定',
  },
  // 选举制度
  {
    pattern: /选举制度.*决定/,
    category: LawCategory.PROCEDURE,
    description: '选举制度',
  },
  // 机构改革
  {
    pattern: /机构改革方案.*决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '机构改革',
  },
  // WTO
  {
    pattern: /加入世界贸易组织.*决定/,
    category: LawCategory.ECONOMIC,
    description: 'WTO',
  },
  // 名额分配
  {
    pattern: /代表名额.*决定|名额分配方案/,
    category: LawCategory.PROCEDURE,
    description: '名额分配',
  },
  // 国家级 - 组织法
  {
    pattern: /居民委员会组织法|村民委员会组织法|人民政府组织法/,
    category: LawCategory.CIVIL,
    description: '组织法',
  },
  // 国家级 - 监察法
  {
    pattern: /^中华人民共和国监察法$/,
    category: LawCategory.ADMINISTRATIVE,
    description: '监察法',
  },
  // 国家级 - 检察官法
  {
    pattern: /^中华人民共和国检察官法$/,
    category: LawCategory.PROCEDURE,
    description: '检察官法',
  },
  // 国家级 - 法官法
  {
    pattern: /^中华人民共和国法官法$/,
    category: LawCategory.PROCEDURE,
    description: '法官法',
  },
  // 国家级 - 代表法
  {
    pattern: /全国人民代表大会和地方各级人民代表大会代表法$/,
    category: LawCategory.PROCEDURE,
    description: '代表法',
  },
  // 国家级 - 立法法
  {
    pattern: /^中华人民共和国立法法$/,
    category: LawCategory.PROCEDURE,
    description: '立法法',
  },
  // 国家级 - 国防法
  {
    pattern: /^中华人民共和国国防法$/,
    category: LawCategory.ADMINISTRATIVE,
    description: '国防法',
  },
  // 国家级 - 国徽法
  {
    pattern: /^中华人民共和国国徽法$/,
    category: LawCategory.ADMINISTRATIVE,
    description: '国徽法',
  },
  // 国家级 - 国旗法
  {
    pattern: /^中华人民共和国国旗法$/,
    category: LawCategory.ADMINISTRATIVE,
    description: '国旗法',
  },
  // 国家级 - 监督法
  {
    pattern: /各级人民代表大会常务委员会监督法$/,
    category: LawCategory.PROCEDURE,
    description: '监督法',
  },
  // 国家级 - 全国人大组织法
  {
    pattern: /全国人民代表大会组织法$/,
    category: LawCategory.PROCEDURE,
    description: '组织法',
  },
  // 试点改革类
  {
    pattern: /改革试点工作.*决定|改革试点.*决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '改革试点',
  },
  // 试点期限延长类
  {
    pattern: /试点期限.*决定|暂时调整.*期限.*决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '试点期限',
  },
  // 刑事处罚类决定
  {
    pattern: /惩治.*犯罪|严禁.*决定|拐卖.*决定/,
    category: LawCategory.CRIMINAL,
    description: '刑事决定',
  },
  // 税收犯罪类
  {
    pattern: /增值税专用发票.*决定/,
    category: LawCategory.CRIMINAL,
    description: '发票犯罪',
  },
  // 香港澳门相关
  {
    pattern: /香港特别行政区.*决定|澳门特别行政区.*决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '港澳决定',
  },
  // 选举制度
  {
    pattern: /选举制度.*决定/,
    category: LawCategory.PROCEDURE,
    description: '选举制度',
  },
  // 机构改革
  {
    pattern: /机构改革方案.*决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '机构改革',
  },
  // WTO
  {
    pattern: /加入世界贸易组织.*决定/,
    category: LawCategory.ECONOMIC,
    description: 'WTO',
  },
  // 地方性法规 - 气瓶安全
  {
    pattern: /气瓶安全.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '气瓶安全',
  },
  // 地方性法规 - 环境保护税
  {
    pattern: /环境保护税适用税额.*决定/,
    category: LawCategory.ECONOMIC,
    description: '环保税',
  },
  // 地方性法规 - 红树林保护
  {
    pattern: /红树林保护.*规定|红树林保护.*条例/,
    category: LawCategory.ECONOMIC,
    description: '红树林',
  },
  // 地方性法规 - 动物疫病区管理
  {
    pattern: /无规定动物疫病区.*管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '疫病区',
  },
  // 地方性法规 - 预算绩效管理
  {
    pattern: /预算绩效管理.*决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '预算绩效',
  },
  // 地方性法规 - 外来投资服务保障
  {
    pattern: /外来投资服务和保障.*条例/,
    category: LawCategory.ECONOMIC,
    description: '外来投资',
  },
  // 地方性法规 - 城市综合管理
  {
    pattern: /城市综合管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '综合管理',
  },
  // 地方性法规 - 城市黄线管理
  {
    pattern: /城市黄线.*管理办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '黄线',
  },
  // 地方性法规 - 台湾同胞投资保障
  {
    pattern: /台湾同胞投资保障.*条例/,
    category: LawCategory.ECONOMIC,
    description: '台胞投资',
  },
  // 地方性法规 - 禁牧条例
  {
    pattern: /禁牧.*条例/,
    category: LawCategory.ECONOMIC,
    description: '禁牧',
  },
  // 地方性法规 - 就业创业促进
  {
    pattern: /就业创业促进.*条例/,
    category: LawCategory.LABOR,
    description: '就业创业',
  },
  // 地方性法规 - 博物馆规定
  {
    pattern: /博物馆.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '博物馆',
  },
  // 地方性法规 - 防御雷电灾害
  {
    pattern: /防御雷电灾害.*条例/,
    category: LawCategory.ECONOMIC,
    description: '雷电灾害',
  },
  // 地方性法规 - 矿山生态恢复治理
  {
    pattern: /矿山生态环境恢复治理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '矿山生态',
  },
  // 地方性法规 - 烟草专卖法实施
  {
    pattern: /烟草专卖法.*实施办法/,
    category: LawCategory.ECONOMIC,
    description: '烟草',
  },
  // 地方性法规 - 监督审计整改
  {
    pattern: /监督审计查出问题整改.*办法/,
    category: LawCategory.PROCEDURE,
    description: '审计整改',
  },
  // 地方性法规 - 调整实施法规决定
  {
    pattern: /调整实施.*有关.*规定.*决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '调整实施',
  },
  // 地方性法规 - 流动人口服务管理
  {
    pattern: /流动人口服务管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '流动人口',
  },
  // 地方性法规 - 价格条例
  {
    pattern: /价格条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '价格',
  },
  // 地方性法规 - 法规解释
  {
    pattern: /法规.*解释/,
    category: LawCategory.PROCEDURE,
    description: '法规解释',
  },
  // 地方性法规 - 水库管理办法
  {
    pattern: /水库.*管理办法/,
    category: LawCategory.ECONOMIC,
    description: '水库',
  },
  // 地方性法规 - 禁止选择性终止妊娠
  {
    pattern: /禁止选择性终止妊娠.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '终止妊娠',
  },
  // 地方性法规 - 市政设施管理
  {
    pattern: /市政设施.*管理办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '市政设施',
  },
  // 地方性法规 - 住宅小区计划生育管理
  {
    pattern: /住宅小区.*计划生育.*服务.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '计划生育',
  },
  // 地方性法规 - 预防职务犯罪
  {
    pattern: /预防职务犯罪.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '职务犯罪',
  },
  // 地方性法规 - 世界级生态岛
  {
    pattern: /世界级生态岛.*决定/,
    category: LawCategory.ECONOMIC,
    description: '生态岛',
  },
  // 地方性法规 - 鼠疫预防控制
  {
    pattern: /鼠疫预防和控制.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '鼠疫',
  },
  // 地方性法规 - 平安建设
  {
    pattern: /平安建设.*决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '平安建设',
  },
  // 地方性法规 - 肉品管理
  {
    pattern: /肉品管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '肉品',
  },
  // 地方性法规 - 空间规划
  {
    pattern: /空间规划.*条例/,
    category: LawCategory.ECONOMIC,
    description: '空间规划',
  },
  // 地方性法规 - 改革创新促进
  {
    pattern: /改革创新促进.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '改革创新',
  },
  // 地方性法规 - 土地储备
  {
    pattern: /土地储备.*条例/,
    category: LawCategory.ECONOMIC,
    description: '土地储备',
  },
  // 地方性法规 - 社会急救医疗
  {
    pattern: /社会急救医疗.*条例/,
    category: LawCategory.ECONOMIC,
    description: '急救医疗',
  },
  // 地方性法规 - 限制养犬
  {
    pattern: /限制养犬.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '限制养犬',
  },
  // 地方性法规 - 村镇建设
  {
    pattern: /村镇建设.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '村镇建设',
  },
  // 地方性法规 - 居民委员会工作
  {
    pattern: /居民委员会工作.*条例/,
    category: LawCategory.PROCEDURE,
    description: '居委会',
  },
  // 地方性法规 - 商业网点规划建设
  {
    pattern: /商业网点规划建设.*条例/,
    category: LawCategory.ECONOMIC,
    description: '商业网点',
  },
  // 地方性法规 - 拥军优属
  {
    pattern: /拥军优属.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '拥军优属',
  },
  // 地方性法规 - 新村聚居点管理
  {
    pattern: /新村聚居点.*管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '新村',
  },

  // ============ 2026-02-18 新增规则 ============
  {
    pattern: /社区工作.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '社区工作',
  },
  {
    pattern: /计算机信息系统安全管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '信息化管理',
  },
  {
    pattern: /林权管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '林权管理',
  },
  {
    pattern: /企业民主管理.*条例/,
    category: LawCategory.LABOR,
    description: '企业民主管理',
  },
  {
    pattern: /突发事件应对.*条例|突发事件应对.*办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '突发事件应对',
  },
  {
    pattern: /地质灾害防治.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '地质灾害防治',
  },
  {
    pattern: /综合实验区.*开放开发.*决定/,
    category: LawCategory.ECONOMIC,
    description: '综合实验区',
  },
  {
    pattern: /水能资源开发利用.*条例/,
    category: LawCategory.ECONOMIC,
    description: '水能资源',
  },
  {
    pattern: /房屋登记.*条例/,
    category: LawCategory.CIVIL,
    description: '房屋登记',
  },
  {
    pattern: /出租汽车客运.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '出租车管理',
  },
  {
    pattern: /地面沉降防治.*条例/,
    category: LawCategory.ECONOMIC,
    description: '地面沉降防治',
  },
  {
    pattern: /全民健身.*规定|全民健身.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '全民健身',
  },
  {
    pattern: /循环经济促进法.*实施办法/,
    category: LawCategory.ECONOMIC,
    description: '循环经济',
  },
  {
    pattern: /社会科学优秀成果奖励.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '社科奖励',
  },
  {
    pattern: /促进中部地区崛起.*战略支点.*条例/,
    category: LawCategory.ECONOMIC,
    description: '中部崛起',
  },
  {
    pattern: /台湾同胞投资.*保障.*条例/,
    category: LawCategory.ECONOMIC,
    description: '台胞投资',
  },
  {
    pattern: /社会保险基金监督.*条例/,
    category: LawCategory.ECONOMIC,
    description: '社保基金监督',
  },
  {
    pattern: /劳动用工.*条例/,
    category: LawCategory.LABOR,
    description: '劳动用工',
  },
  {
    pattern: /工业热力管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '工业热力',
  },
  {
    pattern: /烟草专卖.*条例|烟草专卖.*管理办法/,
    category: LawCategory.ECONOMIC,
    description: '烟草专卖',
  },
  {
    pattern: /建设工程材料管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '建材管理',
  },
  {
    pattern: /外商投资企业.*来料加工企业.*规定/,
    category: LawCategory.ECONOMIC,
    description: '外商投资',
  },
  {
    pattern: /见义勇为.*奖励.*保障.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '见义勇为',
  },
  {
    pattern: /国民经济和社会发展计划.*审批监督.*条例/,
    category: LawCategory.ECONOMIC,
    description: '国民经济计划',
  },
  {
    pattern: /商品质量监督.*条例/,
    category: LawCategory.ECONOMIC,
    description: '商品质量',
  },
  {
    pattern: /取水管理.*办法|取水.*条例/,
    category: LawCategory.ECONOMIC,
    description: '取水管理',
  },
  {
    pattern: /新型墙体材料.*条例/,
    category: LawCategory.ECONOMIC,
    description: '新型墙体材料',
  },
  {
    pattern: /计划免疫.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '计划免疫',
  },
  {
    pattern: /体育场地.*管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '体育场地',
  },
  {
    pattern: /水生野生动物保护.*规定|水生野生动物保护.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '水生野生动物',
  },
  {
    pattern: /木材运输管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '木材运输',
  },

  // ============ 2026-02-18 第二批新增规则 ============
  {
    pattern: /餐饮服务从业人员.*佩戴口罩.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '餐饮口罩规定',
  },
  {
    pattern: /校车安全管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '校车安全',
  },
  {
    pattern: /反餐饮浪费.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '反餐饮浪费',
  },
  {
    pattern: /社会医疗保险.*条例/,
    category: LawCategory.ECONOMIC,
    description: '社会医疗保险',
  },
  {
    pattern: /大型群众性活动安全管理.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '大型活动安全',
  },
  {
    pattern: /医疗纠纷预防和处理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '医疗纠纷',
  },
  {
    pattern: /胶东调水.*条例/,
    category: LawCategory.ECONOMIC,
    description: '调水工程',
  },
  {
    pattern: /人口和计划生育.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '计划生育',
  },
  {
    pattern: /电子商务.*条例/,
    category: LawCategory.ECONOMIC,
    description: '电子商务',
  },
  {
    pattern: /警务辅助人员.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '警务辅助',
  },
  {
    pattern: /食盐.*管理条例|食盐.*管理办法/,
    category: LawCategory.ECONOMIC,
    description: '食盐管理',
  },
  {
    pattern: /国家通用语言文字.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '语言文字',
  },
  {
    pattern: /水上搜寻救助.*条例|水上搜救.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '水上搜救',
  },
  {
    pattern: /接诉即办.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '接诉即办',
  },
  {
    pattern: /塑料购物袋.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '塑料购物袋',
  },
  {
    pattern: /公共资源交易.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '公共资源交易',
  },
  {
    pattern: /出版物发行.*管理条例|音像制品.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '出版物音像',
  },
  {
    pattern: /门前三包.*管理规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '门前三包',
  },
  {
    pattern: /城市国际化促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '城市国际化',
  },
  {
    pattern: /环城绿道.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '环城绿道',
  },
  {
    pattern: /合同行为管理监督.*规定/,
    category: LawCategory.ECONOMIC,
    description: '合同监管',
  },
  {
    pattern: /食品小作坊小餐饮店小食杂店和食品摊贩.*规定/,
    category: LawCategory.ECONOMIC,
    description: '食品摊贩管理',
  },
  {
    pattern: /企业商号.*管理和保护.*规定/,
    category: LawCategory.ECONOMIC,
    description: '商号保护',
  },
  {
    pattern: /雄安新区条例/,
    category: LawCategory.ECONOMIC,
    description: '雄安新区',
  },
  {
    pattern: /禁止不可降解一次性塑料制品.*规定/,
    category: LawCategory.ECONOMIC,
    description: '禁塑规定',
  },
  {
    pattern: /医疗废物.*管理条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '医疗废物',
  },
  {
    pattern: /颐养之家.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '颐养之家',
  },
  {
    pattern: /生态公益林.*补偿.*办法/,
    category: LawCategory.ECONOMIC,
    description: '生态公益林',
  },
  {
    pattern: /建设工程抗震.*管理办法/,
    category: LawCategory.ECONOMIC,
    description: '抗震管理',
  },

  // ============ 2026-02-18 第三批新增规则 ============
  {
    pattern: /再生育.*决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '再生育决定',
  },
  {
    pattern: /查处.*假冒伪劣.*决定|严厉查处.*假冒伪劣/,
    category: LawCategory.ECONOMIC,
    description: '查处假冒伪劣',
  },
  {
    pattern: /查禁卖淫嫖娼.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '查禁卖淫嫖娼',
  },
  {
    pattern: /城市排水.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '城市排水',
  },
  {
    pattern: /道路货物运输.*管理办法/,
    category: LawCategory.ECONOMIC,
    description: '道路货运',
  },
  {
    pattern: /房屋拆迁.*管理办法/,
    category: LawCategory.CIVIL,
    description: '房屋拆迁',
  },
  {
    pattern: /蔬菜基地.*建设保护.*办法/,
    category: LawCategory.ECONOMIC,
    description: '蔬菜基地',
  },
  {
    pattern: /防雷减灾.*办法/,
    category: LawCategory.ECONOMIC,
    description: '防雷减灾',
  },
  {
    pattern: /出版.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '出版管理',
  },
  {
    pattern: /劳动就业.*条例/,
    category: LawCategory.LABOR,
    description: '劳动就业',
  },
  {
    pattern: /职业技能鉴定.*管理条例/,
    category: LawCategory.LABOR,
    description: '职业技能鉴定',
  },
  {
    pattern: /保守国家秘密.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '保守国家秘密',
  },
  {
    pattern: /查处.*伪劣商品.*行为.*条例/,
    category: LawCategory.ECONOMIC,
    description: '查处伪劣商品',
  },
  {
    pattern: /保安服务.*管理条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '保安服务',
  },
  {
    pattern: /乡村规划建设.*条例/,
    category: LawCategory.ECONOMIC,
    description: '乡村规划',
  },
  {
    pattern: /国有土地使用权出让和转让.*办法/,
    category: LawCategory.ECONOMIC,
    description: '土地使用权',
  },
  {
    pattern: /水工程.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '水工程',
  },
  {
    pattern: /果业.*条例/,
    category: LawCategory.ECONOMIC,
    description: '果业',
  },
  {
    pattern: /严厉打击.*暴力恐怖犯罪.*决定/,
    category: LawCategory.CRIMINAL,
    description: '打击暴恐',
  },
  {
    pattern: /使用.*老文字.*决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '老文字',
  },
  {
    pattern: /经济特区.*管理条例|特区.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '经济特区管理',
  },
  {
    pattern: /民营经济促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '民营经济',
  },
  {
    pattern: /排水.*条例/,
    category: LawCategory.ECONOMIC,
    description: '排水管理',
  },
  {
    pattern: /网约配送员.*劳动权益.*规定/,
    category: LawCategory.LABOR,
    description: '网约配送员',
  },
  {
    pattern: /征地.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '征地管理',
  },

  // ============ 2026-02-18 国家级法律分类规则 ============
  {
    pattern: /中华人民共和国.*选举法$/,
    category: LawCategory.PROCEDURE,
    description: '选举法-程序法',
  },
  {
    pattern: /中华人民共和国.*维护国家安全法|香港特别行政区维护国家安全法/,
    category: LawCategory.CRIMINAL,
    description: '国安法-刑事',
  },
  {
    pattern: /中华人民共和国.*政务处分法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '政务处分法-行政',
  },
  {
    pattern: /中华人民共和国.*英雄烈士保护法/,
    category: LawCategory.CIVIL,
    description: '英雄烈士保护-民事',
  },
  {
    pattern: /中华人民共和国.*人民陪审员法/,
    category: LawCategory.PROCEDURE,
    description: '陪审员法-程序法',
  },
  {
    pattern: /中华人民共和国.*国歌法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '国歌法-行政',
  },
  {
    pattern: /中华人民共和国.*国家安全法$/,
    category: LawCategory.ADMINISTRATIVE,
    description: '国家安全法-行政',
  },
  {
    pattern: /中华人民共和国.*集会游行示威法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '集会游行示威法-行政',
  },
  {
    pattern: /反分裂国家法$/,
    category: LawCategory.CRIMINAL,
    description: '反分裂国家法-刑事',
  },
  {
    pattern: /中华人民共和国.*驻军法$/,
    category: LawCategory.ADMINISTRATIVE,
    description: '驻军法-行政',
  },
  {
    pattern: /中华人民共和国.*专属经济区.*大陆架法/,
    category: LawCategory.ECONOMIC,
    description: '海域法-经济',
  },
  {
    pattern: /中华人民共和国.*戒严法$/,
    category: LawCategory.ADMINISTRATIVE,
    description: '戒严法-行政',
  },
  {
    pattern: /中华人民共和国.*基本法$/,
    category: LawCategory.PROCEDURE,
    description: '基本法-宪法性',
  },
  {
    pattern: /中华人民共和国.*领海及毗连区法/,
    category: LawCategory.ECONOMIC,
    description: '领海法-经济',
  },
  {
    pattern: /中华人民共和国.*缔结条约程序法/,
    category: LawCategory.PROCEDURE,
    description: '条约程序法-程序',
  },
  {
    pattern: /.*特权与豁免条例$/,
    category: LawCategory.ECONOMIC,
    description: '特权豁免条例-经济',
  },
  {
    pattern: /全国人民代表大会常务委员会关于.*代表.*直接选举.*规定/,
    category: LawCategory.PROCEDURE,
    description: '直接选举规定-程序',
  },
  {
    pattern: /中华人民共和国.*国务院组织法$/,
    category: LawCategory.ADMINISTRATIVE,
    description: '国务院组织法-行政',
  },
  {
    pattern: /中华人民共和国.*国籍法$/,
    category: LawCategory.CIVIL,
    description: '国籍法-民事',
  },
  {
    pattern: /中华人民共和国.*慈善法$/,
    category: LawCategory.ADMINISTRATIVE,
    description: '慈善法-行政',
  },
  {
    pattern: /中华人民共和国.*妇女权益保障法$/,
    category: LawCategory.CIVIL,
    description: '妇女权益保障-民事',
  },
  {
    pattern: /中华人民共和国.*退役军人保障法$/,
    category: LawCategory.ADMINISTRATIVE,
    description: '退役军人保障-行政',
  },
  {
    pattern: /中华人民共和国.*职业病防治法$/,
    category: LawCategory.ADMINISTRATIVE,
    description: '职业病防治-行政',
  },
  {
    pattern: /中华人民共和国.*境外非政府组织.*活动管理法$/,
    category: LawCategory.ADMINISTRATIVE,
    description: '境外NGO管理-行政',
  },
  {
    pattern: /中华人民共和国.*红十字会法$/,
    category: LawCategory.ADMINISTRATIVE,
    description: '红十字会法-行政',
  },
  {
    pattern: /中华人民共和国.*矿山安全法$/,
    category: LawCategory.ECONOMIC,
    description: '矿山安全法-经济',
  },
  {
    pattern: /全国人民代表大会常务委员会.*关于.*退休.*暂行办法.*决议/,
    category: LawCategory.LABOR,
    description: '退休退职办法-劳动',
  },
  {
    pattern: /全国人民代表大会常务委员会关于.*解释$/,
    category: LawCategory.PROCEDURE,
    description: '法律解释-程序',
  },
  {
    pattern: /全国人民代表大会常务委员会关于.*决定$/,
    category: LawCategory.PROCEDURE,
    description: '人大常委会决定-程序',
  },
  {
    pattern: /全国人民代表大会常务委员会.*授权.*决定/,
    category: LawCategory.PROCEDURE,
    description: '授权决定-程序',
  },
  {
    pattern: /.*关于.*选举方案$/,
    category: LawCategory.PROCEDURE,
    description: '选举方案-程序',
  },
  {
    pattern: /.*关于.*债务限额.*决定/,
    category: LawCategory.ECONOMIC,
    description: '债务限额决定-经济',
  },
  {
    pattern: /.*关于.*生态日.*决定/,
    category: LawCategory.ECONOMIC,
    description: '生态日决定-经济',
  },

  // ============ 2026-02-18 第四批新增规则 ============
  {
    pattern: /房产.*管理条例/,
    category: LawCategory.CIVIL,
    description: '房产管理',
  },
  {
    pattern: /城市公共客运.*管理条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '城市客运',
  },
  {
    pattern: /征用集体土地.*条例/,
    category: LawCategory.ECONOMIC,
    description: '征地',
  },
  {
    pattern: /陆生野生动物保护.*管理规定/,
    category: LawCategory.ECONOMIC,
    description: '陆生野生动物',
  },
  {
    pattern: /收费.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '收费管理',
  },
  {
    pattern: /实施.*矿产资源法.*办法/,
    category: LawCategory.ECONOMIC,
    description: '矿产资源',
  },
  {
    pattern: /社会保险费征缴.*条例/,
    category: LawCategory.ECONOMIC,
    description: '社保征缴',
  },
  {
    pattern: /农作物病虫害防治.*条例/,
    category: LawCategory.ECONOMIC,
    description: '病虫害防治',
  },
  {
    pattern: /医疗纠纷预防与处置.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '医疗纠纷',
  },
  {
    pattern: /蔬菜基地.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '蔬菜基地',
  },
  {
    pattern: /查禁赌博.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '查禁赌博',
  },
  {
    pattern: /三峡工程.*移民.*条例/,
    category: LawCategory.ECONOMIC,
    description: '三峡移民',
  },
  {
    pattern: /口岸服务.*条例/,
    category: LawCategory.ECONOMIC,
    description: '口岸服务',
  },
  {
    pattern: /生育保险.*条例/,
    category: LawCategory.ECONOMIC,
    description: '生育保险',
  },
  {
    pattern: /基本医疗保险.*条例/,
    category: LawCategory.ECONOMIC,
    description: '基本医疗保险',
  },
  {
    pattern: /城市绿线.*管理办法/,
    category: LawCategory.ECONOMIC,
    description: '城市绿线',
  },
  {
    pattern: /保税港区.*条例/,
    category: LawCategory.ECONOMIC,
    description: '保税港区',
  },
  {
    pattern: /任免地方国家机关工作人员.*办法/,
    category: LawCategory.PROCEDURE,
    description: '任免办法',
  },
  {
    pattern: /县乡两级人民代表大会.*选举.*细则/,
    category: LawCategory.PROCEDURE,
    description: '人大代表选举',
  },
  {
    pattern: /保障性住房.*条例/,
    category: LawCategory.ECONOMIC,
    description: '保障性住房',
  },
  {
    pattern: /长江桥梁隧道.*条例/,
    category: LawCategory.ECONOMIC,
    description: '桥梁隧道',
  },
  {
    pattern: /地方志工作.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '地方志工作',
  },
  {
    pattern: /外来物种管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '外来物种',
  },
  {
    pattern: /城市桥梁.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '城市桥梁',
  },
  {
    pattern: /妇女权益保障.*若干规定/,
    category: LawCategory.CIVIL,
    description: '妇女权益',
  },
  {
    pattern: /外商投资企业.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '外商投资',
  },
  {
    pattern: /装饰装修.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '装饰装修',
  },
  {
    pattern: /实施.*国家通用语言文字法.*办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '语言文字法实施',
  },
  {
    pattern: /募捐.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '募捐条例',
  },
  {
    pattern: /价格监测.*条例/,
    category: LawCategory.ECONOMIC,
    description: '价格监测',
  },
  {
    pattern: /集会游行示威.*若干规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '集会游行示威',
  },
  {
    pattern: /城市公有房产管理.*办法/,
    category: LawCategory.CIVIL,
    description: '公有房产',
  },
  {
    pattern: /应缴公物处理.*办法/,
    category: LawCategory.ECONOMIC,
    description: '公物处理',
  },

  // ============ 2026-02-18 第五批新增规则 ============
  {
    pattern: /清洁生产促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '清洁生产',
  },
  {
    pattern: /服务业环境管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '服务业环保',
  },
  {
    pattern: /公益林.*条例/,
    category: LawCategory.ECONOMIC,
    description: '公益林',
  },
  {
    pattern: /堤坝管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '堤坝管理',
  },
  {
    pattern: /公用事业特许经营.*条例/,
    category: LawCategory.ECONOMIC,
    description: '特许经营',
  },
  {
    pattern: /食用农产品安全监督.*条例/,
    category: LawCategory.ECONOMIC,
    description: '食用农产品',
  },
  {
    pattern: /企业负担监督.*条例/,
    category: LawCategory.ECONOMIC,
    description: '企业负担',
  },
  {
    pattern: /高新技术发展.*条例/,
    category: LawCategory.ECONOMIC,
    description: '高新技术',
  },
  {
    pattern: /地方史志工作.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '地方史志',
  },
  {
    pattern: /酒类商品管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '酒类管理',
  },
  {
    pattern: /取消.*行政许可.*决定/,
    category: LawCategory.PROCEDURE,
    description: '取消行政许可',
  },
  {
    pattern: /政务公开.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '政务公开',
  },
  {
    pattern: /实施.*测绘法.*办法/,
    category: LawCategory.ECONOMIC,
    description: '测绘法实施',
  },
  {
    pattern: /实施.*招标投标法.*办法/,
    category: LawCategory.ECONOMIC,
    description: '招标投标法',
  },
  {
    pattern: /义工服务.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '义工服务',
  },
  {
    pattern: /实施.*中小企业促进法.*办法/,
    category: LawCategory.ECONOMIC,
    description: '中小企业促进',
  },
  {
    pattern: /企业国有产权交易.*办法/,
    category: LawCategory.ECONOMIC,
    description: '产权交易',
  },
  {
    pattern: /废止.*行政许可.*规定/,
    category: LawCategory.PROCEDURE,
    description: '废止行政许可',
  },
  {
    pattern: /渡运安全管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '渡运安全',
  },
  {
    pattern: /外来投资者权益保障.*条例/,
    category: LawCategory.ECONOMIC,
    description: '投资者权益',
  },
  {
    pattern: /企业技术进步.*条例/,
    category: LawCategory.ECONOMIC,
    description: '技术进步',
  },
  {
    pattern: /社区服务.*若干规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '社区服务',
  },
  {
    pattern: /实施.*广告法.*办法/,
    category: LawCategory.ECONOMIC,
    description: '广告法实施',
  },
  {
    pattern: /村镇规划建设.*办法/,
    category: LawCategory.ECONOMIC,
    description: '村镇规划',
  },
  {
    pattern: /实施.*体育法.*办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '体育法实施',
  },
  {
    pattern: /赃物估价管理.*条例/,
    category: LawCategory.PROCEDURE,
    description: '赃物估价',
  },

  // ============ 2026-02-18 第六批新增规则 ============
  {
    pattern: /电梯使用安全.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '电梯安全',
  },
  {
    pattern: /工业遗产保护与利用.*条例/,
    category: LawCategory.ECONOMIC,
    description: '工业遗产',
  },
  {
    pattern: /村庄建设.*条例/,
    category: LawCategory.ECONOMIC,
    description: '村庄建设',
  },
  {
    pattern: /禁止选择胎儿性别.*终止妊娠.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '性别选择禁止',
  },
  {
    pattern: /任免.*监察委员会.*暂行办法/,
    category: LawCategory.PROCEDURE,
    description: '监察委员会任免',
  },
  {
    pattern: /禁止.*含磷洗涤.*规定/,
    category: LawCategory.ECONOMIC,
    description: '含磷洗涤禁止',
  },
  {
    pattern: /燃气.*条例/,
    category: LawCategory.ECONOMIC,
    description: '燃气管理',
  },
  {
    pattern: /危险住宅.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '危险住宅',
  },
  {
    pattern: /扶贫开发.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '扶贫开发',
  },
  {
    pattern: /职业培训.*条例/,
    category: LawCategory.LABOR,
    description: '职业培训',
  },
  {
    pattern: /市政设施.*条例/,
    category: LawCategory.ECONOMIC,
    description: '市政设施',
  },
  {
    pattern: /提高立法质量.*规定/,
    category: LawCategory.PROCEDURE,
    description: '立法质量',
  },
  {
    pattern: /企业技术改造.*条例/,
    category: LawCategory.ECONOMIC,
    description: '技术改造',
  },
  {
    pattern: /新区.*条例/,
    category: LawCategory.ECONOMIC,
    description: '新区条例',
  },
  {
    pattern: /增设电梯.*规定/,
    category: LawCategory.ECONOMIC,
    description: '增设电梯',
  },
  {
    pattern: /松材线虫病防治.*条例/,
    category: LawCategory.ECONOMIC,
    description: '松材线虫病',
  },
  {
    pattern: /城市景观风貌.*条例/,
    category: LawCategory.ECONOMIC,
    description: '景观风貌',
  },
  {
    pattern: /实施.*档案法.*办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '档案法实施',
  },
  {
    pattern: /食品小.*摊点.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '食品摊点',
  },
  {
    pattern: /平安建设.*决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '平安建设',
  },
  {
    pattern: /综合管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '综合管理',
  },
  {
    pattern: /依法行政.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '依法行政',
  },
  {
    pattern: /老字号.*保护发展.*办法/,
    category: LawCategory.ECONOMIC,
    description: '老字号保护',
  },
  {
    pattern: /企业集体协商.*条例/,
    category: LawCategory.LABOR,
    description: '集体协商',
  },
  {
    pattern: /军人军属权益保障.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '军人军属权益',
  },
  {
    pattern: /人大代表.*约见.*办法/,
    category: LawCategory.PROCEDURE,
    description: '人大代表约见',
  },
  {
    pattern: /体育市场.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '体育市场',
  },
  {
    pattern: /个体工商户.*条例/,
    category: LawCategory.ECONOMIC,
    description: '个体工商户',
  },

  // ============ 2026-02-18 第七批新增规则 ============
  {
    pattern: /浦东新区.*规定/,
    category: LawCategory.ECONOMIC,
    description: '浦东新区规定',
  },
  {
    pattern: /南水北调.*水源区.*保护.*决定/,
    category: LawCategory.ECONOMIC,
    description: '南水北调保护',
  },
  {
    pattern: /粮油流通安全.*条例/,
    category: LawCategory.ECONOMIC,
    description: '粮油安全',
  },
  {
    pattern: /野生鸟类保护.*决定/,
    category: LawCategory.ECONOMIC,
    description: '野生鸟类保护',
  },
  {
    pattern: /电网规划建设.*决定/,
    category: LawCategory.ECONOMIC,
    description: '电网建设',
  },
  {
    pattern: /小餐饮管理.*决定/,
    category: LawCategory.ECONOMIC,
    description: '小餐饮管理',
  },
  {
    pattern: /培育发展.*未来产业.*决定/,
    category: LawCategory.ECONOMIC,
    description: '未来产业',
  },
  {
    pattern: /网约房.*未成年人.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '网约房管理',
  },
  {
    pattern: /检察建议工作.*决定|检察建议工作.*决议/,
    category: LawCategory.PROCEDURE,
    description: '检察建议',
  },
  {
    pattern: /民生实事项目.*票决制.*决定/,
    category: LawCategory.PROCEDURE,
    description: '民生票决制',
  },
  {
    pattern: /协同保护.*决定/,
    category: LawCategory.ECONOMIC,
    description: '协同保护',
  },
  {
    pattern: /政府债务审查监督.*决定/,
    category: LawCategory.PROCEDURE,
    description: '债务审查监督',
  },
  {
    pattern: /中华民族共同体.*决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '中华民族共同体',
  },
  {
    pattern: /自动体外除颤器.*决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: 'AED配置',
  },
  {
    pattern: /五个新城.*建设.*决定/,
    category: LawCategory.ECONOMIC,
    description: '新城建设',
  },
  {
    pattern: /田园风光走廊.*管控.*决定/,
    category: LawCategory.ECONOMIC,
    description: '田园风光',
  },
  {
    pattern: /生物医药.*创新.*规定/,
    category: LawCategory.ECONOMIC,
    description: '生物医药创新',
  },
  {
    pattern: /商事调解.*规定/,
    category: LawCategory.PROCEDURE,
    description: '商事调解',
  },
  {
    pattern: /智能网联汽车.*规定/,
    category: LawCategory.ECONOMIC,
    description: '智能网联汽车',
  },
  {
    pattern: /市场准营承诺即入制.*规定/,
    category: LawCategory.ECONOMIC,
    description: '准营承诺制',
  },
  {
    pattern: /企业破产制度.*规定/,
    category: LawCategory.ECONOMIC,
    description: '破产制度',
  },
  {
    pattern: /青年创业就业.*条例/,
    category: LawCategory.LABOR,
    description: '青年创业就业',
  },
  {
    pattern: /爱国卫生.*条例|爱国卫生.*决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '爱国卫生',
  },
  {
    pattern: /综合执法.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '综合执法',
  },
  {
    pattern: /地名.*管理条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '地名管理',
  },
  {
    pattern: /河湖.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '河湖管理',
  },
  {
    pattern: /民族团结进步.*条例|民族团结进步.*决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '民族团结进步',
  },
  {
    pattern: /优化营商环境.*条例/,
    category: LawCategory.ECONOMIC,
    description: '营商环境',
  },
  {
    pattern: /农业高新技术产业.*条例/,
    category: LawCategory.ECONOMIC,
    description: '农业高新产业',
  },

  // ============ 2026-02-18 第八批新增规则 ============
  {
    pattern: /风景区.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '风景区管理',
  },
  {
    pattern: /外语标识.*管理规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '外语标识',
  },
  {
    pattern: /暴雨灾害.*预警.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '暴雨灾害',
  },
  {
    pattern: /绿色转型促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '绿色转型',
  },
  {
    pattern: /罢免和补选.*代表.*程序.*规定/,
    category: LawCategory.PROCEDURE,
    description: '罢免补选程序',
  },
  {
    pattern: /文明祭祀.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '文明祭祀',
  },
  {
    pattern: /房屋专项维修资金.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '维修资金',
  },
  {
    pattern: /桑基鱼塘.*保护.*规定/,
    category: LawCategory.ECONOMIC,
    description: '桑基鱼塘',
  },
  {
    pattern: /公共安全视频图像信息系统.*管理条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '视频图像系统',
  },
  {
    pattern: /国际陆港.*建设促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '国际陆港',
  },
  {
    pattern: /公共休闲场地.*安全管理.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '休闲场地安全',
  },
  {
    pattern: /社区医疗服务.*促进.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '社区医疗',
  },
  {
    pattern: /出租房安全管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '出租房安全',
  },
  {
    pattern: /耕地利用促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '耕地利用',
  },
  {
    pattern: /再生水管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '再生水',
  },
  {
    pattern: /海绵城市规划建设.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '海绵城市',
  },
  {
    pattern: /共富工坊.*管理规定/,
    category: LawCategory.ECONOMIC,
    description: '共富工坊',
  },
  {
    pattern: /涉企服务.*若干规定/,
    category: LawCategory.ECONOMIC,
    description: '涉企服务',
  },
  {
    pattern: /人工影响天气.*安全管理.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '人工影响天气',
  },
  {
    pattern: /民事强制措施.*条例/,
    category: LawCategory.PROCEDURE,
    description: '民事强制措施',
  },
  {
    pattern: /森林林木林地流转.*条例/,
    category: LawCategory.ECONOMIC,
    description: '林地流转',
  },
  {
    pattern: /民用运输机场.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '民用机场',
  },
  {
    pattern: /罚款和没收财物管理.*条例/,
    category: LawCategory.PROCEDURE,
    description: '罚款没收',
  },
  {
    pattern: /高标准农田.*建设和保护.*条例/,
    category: LawCategory.ECONOMIC,
    description: '高标准农田',
  },
  {
    pattern: /城市防洪排涝.*管理办法/,
    category: LawCategory.ECONOMIC,
    description: '防洪排涝',
  },
  {
    pattern: /杂交水稻种子生产.*管理规定/,
    category: LawCategory.ECONOMIC,
    description: '种子生产',
  },
  {
    pattern: /国际商事仲裁中心.*建设.*条例/,
    category: LawCategory.ECONOMIC,
    description: '商事仲裁',
  },
  {
    pattern: /促进市场公平竞争.*条例/,
    category: LawCategory.ECONOMIC,
    description: '公平竞争',
  },
  {
    pattern: /查处道路非法客运.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '非法客运',
  },
  {
    pattern: /水域船舶.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '船舶管理',
  },
  {
    pattern: /调解.*条例/,
    category: LawCategory.PROCEDURE,
    description: '调解条例',
  },
  {
    pattern: /美丽乡村建设.*条例/,
    category: LawCategory.ECONOMIC,
    description: '美丽乡村',
  },
  {
    pattern: /乱挖滥采.*砂石.*规定/,
    category: LawCategory.ECONOMIC,
    description: '乱挖滥采',
  },
  {
    pattern: /车辆停放管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '车辆停放',
  },

  // ============ 2026-02-18 第九批新增规则 ============
  {
    pattern: /创业投资.*条例/,
    category: LawCategory.ECONOMIC,
    description: '创业投资',
  },
  {
    pattern: /核电厂周围.*安全保障.*管理条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '核电安全',
  },
  {
    pattern: /性别平等促进.*条例/,
    category: LawCategory.CIVIL,
    description: '性别平等',
  },
  {
    pattern: /旅馆业.*管理规定/,
    category: LawCategory.ECONOMIC,
    description: '旅馆业',
  },
  {
    pattern: /社会建设促进.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '社会建设',
  },
  {
    pattern: /听取和审议.*专项工作报告.*规则/,
    category: LawCategory.PROCEDURE,
    description: '专项工作报告',
  },
  {
    pattern: /行政体制综合改革.*决定/,
    category: LawCategory.PROCEDURE,
    description: '行政改革',
  },
  {
    pattern: /股份合作公司.*条例/,
    category: LawCategory.ECONOMIC,
    description: '股份合作公司',
  },
  {
    pattern: /和谐劳动关系促进.*条例/,
    category: LawCategory.LABOR,
    description: '和谐劳动关系',
  },
  {
    pattern: /欠薪保障.*条例/,
    category: LawCategory.LABOR,
    description: '欠薪保障',
  },
  {
    pattern: /审计监督工作.*决定/,
    category: LawCategory.PROCEDURE,
    description: '审计监督',
  },
  {
    pattern: /禁止食用野生动物.*规定/,
    category: LawCategory.ECONOMIC,
    description: '禁食野生动物',
  },
  {
    pattern: /停缓建工程.*决定/,
    category: LawCategory.ECONOMIC,
    description: '停缓建工程',
  },
  {
    pattern: /查处.*黄赌毒.*决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '查处黄赌毒',
  },
  {
    pattern: /档案与文件收集利用.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '档案利用',
  },
  {
    pattern: /历史遗留违法私房.*规定/,
    category: LawCategory.CIVIL,
    description: '违法私房',
  },
  {
    pattern: /家庭服务业.*条例/,
    category: LawCategory.ECONOMIC,
    description: '家庭服务业',
  },
  {
    pattern: /查处无照经营.*规定/,
    category: LawCategory.ECONOMIC,
    description: '无照经营',
  },
  {
    pattern: /征地补偿.*规定/,
    category: LawCategory.ECONOMIC,
    description: '征地补偿',
  },
  {
    pattern: /股份有限公司监督管理.*规定/,
    category: LawCategory.ECONOMIC,
    description: '股份公司监管',
  },
  {
    pattern: /导游人员.*管理规定/,
    category: LawCategory.ECONOMIC,
    description: '导游管理',
  },
  {
    pattern: /旅行社.*管理规定/,
    category: LawCategory.ECONOMIC,
    description: '旅行社管理',
  },
  {
    pattern: /渡口渡船.*安全管理.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '渡口渡船安全',
  },
  {
    pattern: /水条例$/,
    category: LawCategory.ECONOMIC,
    description: '水资源条例',
  },
  {
    pattern: /打击.*携款潜逃.*决定/,
    category: LawCategory.PROCEDURE,
    description: '打击携款潜逃',
  },
  {
    pattern: /工伤保险.*若干规定/,
    category: LawCategory.ECONOMIC,
    description: '工伤保险',
  },

  // ============ 2026-02-18 第十批新增规则 ============
  {
    pattern: /千万工程.*条例/,
    category: LawCategory.ECONOMIC,
    description: '千万工程',
  },
  {
    pattern: /中小学生集中就餐.*健康.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '学生就餐健康',
  },
  {
    pattern: /粮食生产促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '粮食生产',
  },
  {
    pattern: /种业促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '种业促进',
  },
  {
    pattern: /风貌管控.*条例/,
    category: LawCategory.ECONOMIC,
    description: '风貌管控',
  },
  {
    pattern: /和美乡村建设.*条例/,
    category: LawCategory.ECONOMIC,
    description: '和美乡村',
  },
  {
    pattern: /林长制.*规定|林长制.*条例/,
    category: LawCategory.ECONOMIC,
    description: '林长制',
  },
  {
    pattern: /工业用地控制线.*管理规定/,
    category: LawCategory.ECONOMIC,
    description: '工业用地控制',
  },
  {
    pattern: /.*产业促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '产业促进',
  },
  {
    pattern: /绣花式城市治理.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '绣花式治理',
  },
  {
    pattern: /综合查一次.*规定/,
    category: LawCategory.PROCEDURE,
    description: '综合执法',
  },
  {
    pattern: /科创大走廊.*条例/,
    category: LawCategory.ECONOMIC,
    description: '科创走廊',
  },
  {
    pattern: /商业秘密保护.*规定/,
    category: LawCategory.ECONOMIC,
    description: '商业秘密保护',
  },
  {
    pattern: /民用爆炸物品安全管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '民爆物品安全',
  },
  {
    pattern: /.*振兴促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '振兴促进',
  },
  {
    pattern: /出生缺陷防治.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '出生缺陷防治',
  },
  {
    pattern: /促进公平竞争.*条例/,
    category: LawCategory.ECONOMIC,
    description: '公平竞争',
  },
  {
    pattern: /生活垃圾资源化利用.*规定/,
    category: LawCategory.ECONOMIC,
    description: '垃圾资源化',
  },
  {
    pattern: /涉案物价格认定.*规定/,
    category: LawCategory.PROCEDURE,
    description: '价格认定',
  },
  {
    pattern: /成品油流通管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '成品油管理',
  },
  {
    pattern: /工业设计促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '工业设计',
  },
  {
    pattern: /农产品品牌培育.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '农产品品牌',
  },
  {
    pattern: /自然灾害防治.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '自然灾害防治',
  },
  {
    pattern: /平安建设源头治理.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '平安建设',
  },
  {
    pattern: /污染环境防治和综合利用.*条例/,
    category: LawCategory.ECONOMIC,
    description: '污染防治',
  },
  {
    pattern: /托育服务促进.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '托育服务',
  },
  {
    pattern: /废弃.*污染环境防治.*规定/,
    category: LawCategory.ECONOMIC,
    description: '废弃物污染',
  },
  {
    pattern: /工作委员会.*工作条例/,
    category: LawCategory.PROCEDURE,
    description: '工作委员会',
  },
  {
    pattern: /建议.*批评.*意见.*办理规则/,
    category: LawCategory.PROCEDURE,
    description: '建议办理',
  },
  {
    pattern: /物业服务管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '物业服务',
  },
  {
    pattern: /燃气运输与配送.*管理规定/,
    category: LawCategory.ECONOMIC,
    description: '燃气配送',
  },
  {
    pattern: /摩崖石刻保护.*规定/,
    category: LawCategory.ECONOMIC,
    description: '摩崖石刻',
  },
  {
    pattern: /食用农产品安全.*条例/,
    category: LawCategory.ECONOMIC,
    description: '食用农产品安全',
  },
  {
    pattern: /.*保护发展.*条例/,
    category: LawCategory.ECONOMIC,
    description: '保护发展',
  },
  {
    pattern: /文明行为.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '文明行为',
  },

  // ============ 2026-02-18 第十一批新增规则 ============
  {
    pattern: /全国人民代表大会常务委员会公告.*附件.*修正案/,
    category: LawCategory.PROCEDURE,
    description: '基本法附件修正案',
  },
  {
    pattern:
      /全国人民代表大会.*关于设立.*的决定|全国人民代表大会.*关于建立.*的决定/,
    category: LawCategory.PROCEDURE,
    description: '设立建立决定',
  },
  {
    pattern:
      /关于.*国都.*决议|关于.*纪年.*决议|关于.*国庆.*决议|关于.*国歌.*决议|关于.*国旗.*决议/,
    category: LawCategory.PROCEDURE,
    description: '宪制性决议',
  },
  {
    pattern: /授权国务院.*暂行.*规定.*决定/,
    category: LawCategory.PROCEDURE,
    description: '授权国务院决定',
  },
  {
    pattern: /技术经理人.*培育发展.*条例/,
    category: LawCategory.ECONOMIC,
    description: '技术经理人',
  },
  {
    pattern: /碳账户.*建设和应用.*条例/,
    category: LawCategory.ECONOMIC,
    description: '碳账户',
  },
  {
    pattern: /自动驾驶汽车.*发展.*条例/,
    category: LawCategory.ECONOMIC,
    description: '自动驾驶汽车',
  },
  {
    pattern: /河湖保护治理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '河湖保护',
  },
  {
    pattern: /社区戒毒社区康复.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '社区戒毒',
  },
  {
    pattern: /.*保护.*若干规定/,
    category: LawCategory.ECONOMIC,
    description: '河流保护',
  },
  {
    pattern: /母婴设施.*建设管理.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '母婴设施',
  },
  {
    pattern: /家政服务.*规定/,
    category: LawCategory.ECONOMIC,
    description: '家政服务',
  },
  {
    pattern: /征收集体所有土地房屋补偿.*条例/,
    category: LawCategory.ECONOMIC,
    description: '房屋补偿',
  },
  {
    pattern: /住宅小区物业服务.*条例/,
    category: LawCategory.ECONOMIC,
    description: '物业服务',
  },
  {
    pattern: /老年助餐服务.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '老年助餐',
  },
  {
    pattern: /早夜市.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '早夜市',
  },
  {
    pattern: /人参产业.*条例/,
    category: LawCategory.ECONOMIC,
    description: '人参产业',
  },
  {
    pattern: /全民健康促进.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '全民健康',
  },
  {
    pattern: /.*梯田保护与利用.*条例/,
    category: LawCategory.ECONOMIC,
    description: '梯田保护',
  },
  {
    pattern: /科技特派员.*工作.*条例/,
    category: LawCategory.ECONOMIC,
    description: '科技特派员',
  },
  {
    pattern: /固边兴边富民.*条例/,
    category: LawCategory.ECONOMIC,
    description: '固边兴边',
  },
  {
    pattern: /民生实事项目.*票决制.*规定/,
    category: LawCategory.PROCEDURE,
    description: '票决制',
  },
  {
    pattern: /主城区规划建设管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '主城区建设',
  },
  {
    pattern: /地方病防治.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '地方病防治',
  },
  {
    pattern: /两岸标准共通.*条例/,
    category: LawCategory.ECONOMIC,
    description: '两岸标准',
  },
  {
    pattern: /开放型经济促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '开放型经济',
  },
  {
    pattern: /.*茶发展.*条例/,
    category: LawCategory.ECONOMIC,
    description: '茶发展',
  },
  {
    pattern: /家庭农场促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '家庭农场',
  },
  {
    pattern: /城市居民委员会选举.*条例/,
    category: LawCategory.PROCEDURE,
    description: '居委会选举',
  },
  {
    pattern: /民营经济促进法.*办法/,
    category: LawCategory.ECONOMIC,
    description: '民营经济促进',
  },
  {
    pattern: /保守国家秘密.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '保守国家秘密',
  },
  {
    pattern: /蚊虫治理.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '蚊虫治理',
  },

  // ============ 2026-02-18 第十二批新增规则 ============
  {
    pattern: /加快发展循环经济.*决定/,
    category: LawCategory.ECONOMIC,
    description: '循环经济',
  },
  {
    pattern: /生态林.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '生态林',
  },
  {
    pattern: /防洪.*管理规定/,
    category: LawCategory.ECONOMIC,
    description: '防洪管理',
  },
  {
    pattern: /实施.*预算法.*办法/,
    category: LawCategory.ECONOMIC,
    description: '预算法实施',
  },
  {
    pattern: /扶持.*老区发展.*条例/,
    category: LawCategory.ECONOMIC,
    description: '老区发展',
  },
  {
    pattern: /商品修理.*更换.*退货.*责任规定/,
    category: LawCategory.ECONOMIC,
    description: '三包规定',
  },
  {
    pattern: /立法听证.*办法/,
    category: LawCategory.PROCEDURE,
    description: '立法听证',
  },
  {
    pattern: /植物园.*条例/,
    category: LawCategory.ECONOMIC,
    description: '植物园',
  },
  {
    pattern: /城市群区域规划.*条例/,
    category: LawCategory.ECONOMIC,
    description: '区域规划',
  },
  {
    pattern: /预防职务犯罪.*决议/,
    category: LawCategory.PROCEDURE,
    description: '预防职务犯罪',
  },
  {
    pattern: /城乡集贸市场.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '集贸市场',
  },
  {
    pattern: /保护老年人.*合法权益.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '老年人权益',
  },
  {
    pattern: /珊瑚礁.*砗磲.*保护.*规定/,
    category: LawCategory.ECONOMIC,
    description: '珊瑚砗磲保护',
  },
  {
    pattern: /建设.*生态省.*决定/,
    category: LawCategory.ECONOMIC,
    description: '生态省建设',
  },
  {
    pattern: /全面推进依法治省.*决议/,
    category: LawCategory.PROCEDURE,
    description: '依法治省',
  },
  {
    pattern: /确定.*省树.*省花.*决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '省树省花',
  },
  {
    pattern: /统计管理.*规定/,
    category: LawCategory.ECONOMIC,
    description: '统计管理',
  },
  {
    pattern: /批准.*设定罚款.*决定/,
    category: LawCategory.PROCEDURE,
    description: '设定罚款决定',
  },
  {
    pattern: /审判方式改革.*决议/,
    category: LawCategory.PROCEDURE,
    description: '审判改革',
  },
  {
    pattern: /取缔.*卖淫嫖娼.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '取缔卖淫嫖娼',
  },
  {
    pattern: /禁止赌博.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '禁止赌博',
  },
  {
    pattern: /执法检查.*条例/,
    category: LawCategory.PROCEDURE,
    description: '执法检查',
  },
  {
    pattern: /创新驱动发展战略.*决定/,
    category: LawCategory.ECONOMIC,
    description: '创新驱动',
  },
  {
    pattern: /人大常委会行使职权.*规定/,
    category: LawCategory.PROCEDURE,
    description: '人大常委会职权',
  },
  {
    pattern: /涉外项目.*国家安全事项.*管理条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '涉外国家安全',
  },
  {
    pattern: /消毒管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '消毒管理',
  },
  {
    pattern: /股份合作制企业.*条例/,
    category: LawCategory.ECONOMIC,
    description: '股份合作制',
  },
  {
    pattern: /著名商标.*认定和保护.*规定/,
    category: LawCategory.ECONOMIC,
    description: '著名商标',
  },
  {
    pattern: /公民旁听.*规定/,
    category: LawCategory.PROCEDURE,
    description: '公民旁听',
  },
  {
    pattern: /荒山有偿开发.*规定/,
    category: LawCategory.ECONOMIC,
    description: '荒山开发',
  },

  // ============ 2026-02-18 第十三批新增规则 ============
  {
    pattern: /会展业.*条例/,
    category: LawCategory.ECONOMIC,
    description: '会展业',
  },
  {
    pattern: /疫情防控.*决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '疫情防控',
  },
  {
    pattern: /城市绿地.*管理条例|城市绿地.*管理办法/,
    category: LawCategory.ECONOMIC,
    description: '城市绿地',
  },
  {
    pattern: /反走私暂行.*条例/,
    category: LawCategory.ECONOMIC,
    description: '反走私',
  },
  {
    pattern: /村庄规划建设.*条例/,
    category: LawCategory.ECONOMIC,
    description: '村庄规划',
  },
  {
    pattern: /滨水区域规划.*条例/,
    category: LawCategory.ECONOMIC,
    description: '滨水规划',
  },
  {
    pattern: /农作物秸秆处置.*条例/,
    category: LawCategory.ECONOMIC,
    description: '秸秆处置',
  },
  {
    pattern: /革命旧址保护利用.*条例/,
    category: LawCategory.ECONOMIC,
    description: '革命旧址',
  },
  {
    pattern: /母乳喂养促进.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '母乳喂养',
  },
  {
    pattern: /国际贸易综合改革试验区.*条例/,
    category: LawCategory.ECONOMIC,
    description: '综改试验区',
  },
  {
    pattern: /测绘地理信息.*条例/,
    category: LawCategory.ECONOMIC,
    description: '测绘地理信息',
  },
  {
    pattern: /封山育林.*条例/,
    category: LawCategory.ECONOMIC,
    description: '封山育林',
  },
  {
    pattern: /乡村房屋建设管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '乡村房屋',
  },
  {
    pattern: /湾长制.*规定|湾长制.*条例/,
    category: LawCategory.ECONOMIC,
    description: '湾长制',
  },
  {
    pattern: /血吸虫病防治.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '血吸虫病',
  },
  {
    pattern: /海龟保护.*规定/,
    category: LawCategory.ECONOMIC,
    description: '海龟保护',
  },
  {
    pattern: /耕地占用税适用税额.*决定/,
    category: LawCategory.ECONOMIC,
    description: '耕地占用税',
  },
  {
    pattern: /鼠疫.*交通检疫.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '鼠疫检疫',
  },
  {
    pattern: /新旧动能转换促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '新旧动能转换',
  },
  {
    pattern: /幼儿园规划建设.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '幼儿园建设',
  },
  {
    pattern: /机构改革.*地方性法规.*职责调整.*决定/,
    category: LawCategory.PROCEDURE,
    description: '机构改革调整',
  },
  {
    pattern: /海水浴场.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '海水浴场',
  },
  {
    pattern: /企业投资项目承诺制.*规定/,
    category: LawCategory.ECONOMIC,
    description: '承诺制',
  },
  {
    pattern: /外商投资法.*贯彻实施.*决定/,
    category: LawCategory.ECONOMIC,
    description: '外商投资法',
  },
  {
    pattern: /无人驾驶航空器公共安全管理.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '无人机管理',
  },

  // ============ 2026-02-18 第十四批新增规则 ============
  {
    pattern: /无障碍设施建设和管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '无障碍设施',
  },
  {
    pattern: /确定.*行使地方立法权.*决定/,
    category: LawCategory.PROCEDURE,
    description: '地方立法权',
  },
  {
    pattern: /重大发展战略.*法制化.*决定/,
    category: LawCategory.PROCEDURE,
    description: '发展战略法制化',
  },
  {
    pattern: /经济工作监督.*条例/,
    category: LawCategory.PROCEDURE,
    description: '经济工作监督',
  },
  {
    pattern: /城市地下管网.*条例/,
    category: LawCategory.ECONOMIC,
    description: '地下管网',
  },
  {
    pattern: /环境保护公众参与.*条例/,
    category: LawCategory.ECONOMIC,
    description: '环保公众参与',
  },
  {
    pattern: /消费者合法权益.*条例|保护消费者.*规定/,
    category: LawCategory.ECONOMIC,
    description: '消费者权益',
  },
  {
    pattern: /食品生产加工小作坊.*监督.*办法/,
    category: LawCategory.ECONOMIC,
    description: '食品小作坊',
  },
  {
    pattern: /国有农牧场.*条例/,
    category: LawCategory.ECONOMIC,
    description: '国有农牧场',
  },
  {
    pattern: /风景名胜保护管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '风景名胜',
  },
  {
    pattern: /兽医.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '兽医管理',
  },
  {
    pattern: /涉案物品估价.*条例/,
    category: LawCategory.PROCEDURE,
    description: '物品估价',
  },
  {
    pattern: /边境沿海地区.*边防管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '边防管理',
  },
  {
    pattern: /出版管理.*规定/,
    category: LawCategory.ECONOMIC,
    description: '出版管理',
  },
  {
    pattern: /船舶.*建造.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '船舶管理',
  },
  {
    pattern: /拍卖管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '拍卖管理',
  },
  {
    pattern: /广告监督管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '广告监管',
  },
  {
    pattern: /水库工程.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '水库工程',
  },
  {
    pattern: /道路客运.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '道路客运',
  },
  {
    pattern: /禁止猎捕.*陆生野生动物.*决定/,
    category: LawCategory.ECONOMIC,
    description: '禁止猎捕野生动物',
  },
  {
    pattern: /国家行政机关工作人员.*奖惩.*办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '工作人员奖惩',
  },
  {
    pattern: /停缓建工程.*管理.*决议/,
    category: LawCategory.ECONOMIC,
    description: '停缓建工程',
  },
  {
    pattern: /县.*乡.*两级人民代表大会.*选举.*细则/,
    category: LawCategory.PROCEDURE,
    description: '县乡人大代表选举',
  },
  {
    pattern: /制止不正当价格行为.*条例/,
    category: LawCategory.ECONOMIC,
    description: '价格监管',
  },
  {
    pattern: /文明单位建设.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '文明单位',
  },
  {
    pattern: /公共汽车电车.*轮渡船.*客运管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '公共交通',
  },
  {
    pattern: /环城防护林带.*条例/,
    category: LawCategory.ECONOMIC,
    description: '防护林带',
  },
  {
    pattern: /统计监督处罚.*条例/,
    category: LawCategory.ECONOMIC,
    description: '统计处罚',
  },
  {
    pattern: /国有重点林区.*条例/,
    category: LawCategory.ECONOMIC,
    description: '国有林区',
  },
  {
    pattern: /木材经营加工.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '木材加工',
  },
  {
    pattern: /酒类管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '酒类管理',
  },
  {
    pattern: /民用机场地区.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '机场管理',
  },
  {
    pattern: /鼓励引进技术的吸收与创新.*规定/,
    category: LawCategory.ECONOMIC,
    description: '技术引进创新',
  },

  // ============ 2026-02-18 第十五批新增规则 ============
  {
    pattern: /住房租赁管理.*规定/,
    category: LawCategory.ECONOMIC,
    description: '住房租赁',
  },
  {
    pattern: /实施.*总体规划.*决定/,
    category: LawCategory.PROCEDURE,
    description: '总体规划',
  },
  {
    pattern: /城镇从业人员基本养老保险.*条例/,
    category: LawCategory.ECONOMIC,
    description: '基本养老保险',
  },
  {
    pattern: /展会管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '展会管理',
  },
  {
    pattern: /秸秆.*露天禁烧.*综合利用.*条例/,
    category: LawCategory.ECONOMIC,
    description: '秸秆管理',
  },
  {
    pattern: /商品流通市场建设与管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '商品流通',
  },
  {
    pattern: /全面深化改革促进.*条例/,
    category: LawCategory.PROCEDURE,
    description: '改革促进',
  },
  {
    pattern: /劳动关系三方协商.*规定/,
    category: LawCategory.LABOR,
    description: '三方协商',
  },
  {
    pattern: /水务管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '水务管理',
  },
  {
    pattern: /妇女权益保障.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '妇女权益',
  },
  {
    pattern: /残疾人权益保障.*条例|残疾人权益保障.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '残疾人权益',
  },
  {
    pattern: /涉案物价格鉴定管理.*条例/,
    category: LawCategory.PROCEDURE,
    description: '价格鉴定',
  },
  {
    pattern: /按比例安排残疾人就业.*办法/,
    category: LawCategory.LABOR,
    description: '残疾人就业',
  },
  {
    pattern: /政府投资管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '政府投资',
  },

  // ============ 2026-02-18 第十六批新增规则 ============
  {
    pattern: /智能网联汽车.*应用促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '智能网联汽车',
  },
  {
    pattern: /交通建设工程监督管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '交通建设监管',
  },
  {
    pattern: /小广告发布管理.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '小广告管理',
  },
  {
    pattern: /漓江.*洲岛滩涂保护.*规定/,
    category: LawCategory.ECONOMIC,
    description: '漓江保护',
  },
  {
    pattern: /生态环境损害赔偿.*程序.*规定/,
    category: LawCategory.ECONOMIC,
    description: '生态损害赔偿',
  },
  {
    pattern: /经营主体服务.*条例/,
    category: LawCategory.ECONOMIC,
    description: '经营主体服务',
  },
  {
    pattern: /河湖林田长制.*条例/,
    category: LawCategory.ECONOMIC,
    description: '河湖林田长制',
  },
  {
    pattern: /分级诊疗促进.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '分级诊疗',
  },
  {
    pattern: /防灾避险.*安全转移.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '安全转移',
  },
  {
    pattern: /民情直通平台.*诉求办理.*条例/,
    category: LawCategory.PROCEDURE,
    description: '民情直通',
  },
  {
    pattern: /婚丧事宜.*移风易俗.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '移风易俗',
  },
  {
    pattern: /电信管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '电信管理',
  },
  {
    pattern: /实施.*黄河保护法.*办法/,
    category: LawCategory.ECONOMIC,
    description: '黄河保护法',
  },
  {
    pattern: /老字号传承与发展.*条例/,
    category: LawCategory.ECONOMIC,
    description: '老字号发展',
  },
  {
    pattern: /资源税具体适用税率.*决定/,
    category: LawCategory.ECONOMIC,
    description: '资源税',
  },
  {
    pattern: /外商投资.*条例/,
    category: LawCategory.ECONOMIC,
    description: '外商投资',
  },
  {
    pattern: /反间谍工作.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '反间谍',
  },
  {
    pattern: /水网建设管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '水网建设',
  },
  {
    pattern: /城中村改造.*条例/,
    category: LawCategory.ECONOMIC,
    description: '城中村改造',
  },
  {
    pattern: /肉牛种业管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '肉牛种业',
  },
  {
    pattern: /首台.*套.*技术装备.*推广应用.*条例/,
    category: LawCategory.ECONOMIC,
    description: '技术装备',
  },
  {
    pattern: /机关效能建设.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '效能建设',
  },
  {
    pattern: /平安.*社区建设.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '社区建设',
  },
  {
    pattern: /滨水区域.*条例/,
    category: LawCategory.ECONOMIC,
    description: '滨水区域',
  },
  {
    pattern: /防空地下室建设和管理.*办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '防空地下室',
  },
  {
    pattern: /乡村建设.*条例/,
    category: LawCategory.ECONOMIC,
    description: '乡村建设',
  },
  {
    pattern: /农牧区人居环境治理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '人居环境',
  },

  // ============ 2026-02-18 第十七批新增规则 ============
  {
    pattern: /龙子湖.*景区.*条例/,
    category: LawCategory.ECONOMIC,
    description: '景区管理',
  },
  {
    pattern: /全面禁止.*非法交易.*滥食野生动物.*决定/,
    category: LawCategory.ECONOMIC,
    description: '禁止滥食野生动物',
  },
  {
    pattern: /医疗废物.*管理办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '医疗废物',
  },
  {
    pattern: /暂时停止实施.*经营许可.*决定/,
    category: LawCategory.ECONOMIC,
    description: '停止经营许可',
  },
  {
    pattern: /化妆品安全.*条例/,
    category: LawCategory.ECONOMIC,
    description: '化妆品安全',
  },
  {
    pattern: /乡镇人民政府工作.*条例/,
    category: LawCategory.PROCEDURE,
    description: '乡镇工作',
  },
  {
    pattern: /小规模食品生产经营.*管理规定/,
    category: LawCategory.ECONOMIC,
    description: '小作坊管理',
  },
  {
    pattern: /民防.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '民防',
  },
  {
    pattern: /古.*群保护.*规定/,
    category: LawCategory.ECONOMIC,
    description: '古树群保护',
  },
  {
    pattern: /城乡清洁.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '城乡清洁',
  },
  {
    pattern: /村寨规划.*条例/,
    category: LawCategory.ECONOMIC,
    description: '村寨规划',
  },
  {
    pattern: /最多跑一次.*改革.*规定/,
    category: LawCategory.PROCEDURE,
    description: '最多跑一次',
  },
  {
    pattern: /台湾同胞投资.*权益保护.*规定/,
    category: LawCategory.ECONOMIC,
    description: '台胞投资保护',
  },
  {
    pattern: /生态控制线.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '生态控制线',
  },
  {
    pattern: /多规合一.*条例/,
    category: LawCategory.PROCEDURE,
    description: '多规合一',
  },
  {
    pattern: /林木保护管理.*规定/,
    category: LawCategory.ECONOMIC,
    description: '林木保护',
  },
  {
    pattern: /采煤塌陷地治理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '塌陷地治理',
  },
  {
    pattern: /封山禁牧.*管理办法/,
    category: LawCategory.ECONOMIC,
    description: '封山禁牧',
  },
  {
    pattern: /区域性国际中心城市.*促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '国际中心城市建设',
  },
  {
    pattern: /数字.*建设.*决定/,
    category: LawCategory.ECONOMIC,
    description: '数字建设',
  },
  {
    pattern: /公共停车.*管理规定/,
    category: LawCategory.ECONOMIC,
    description: '停车管理',
  },
  {
    pattern: /绩效管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '绩效管理',
  },

  // ============ 2026-02-18 通用规则补充 ============
  {
    pattern: /实施.*妇女权益保障法.*办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '妇女权益保障法',
  },
  {
    pattern: /实施.*种子法.*办法/,
    category: LawCategory.ECONOMIC,
    description: '种子法',
  },
  {
    pattern: /电梯.*条例/,
    category: LawCategory.ECONOMIC,
    description: '电梯',
  },
  {
    pattern: /实施.*代表法.*办法/,
    category: LawCategory.PROCEDURE,
    description: '代表法',
  },
  {
    pattern: /环城林带.*保护.*办法/,
    category: LawCategory.ECONOMIC,
    description: '环城林带',
  },
  {
    pattern: /代表.*议案.*提出和处理.*办法/,
    category: LawCategory.PROCEDURE,
    description: '议案处理',
  },
  {
    pattern: /实施.*慈善法.*办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '慈善法',
  },
  {
    pattern: /外商投资法.*贯彻实施.*决定/,
    category: LawCategory.ECONOMIC,
    description: '外商投资法',
  },
  {
    pattern: /乡.*镇人民政府工作.*条例/,
    category: LawCategory.PROCEDURE,
    description: '乡镇政府',
  },
  {
    pattern: /广告.*条例/,
    category: LawCategory.ECONOMIC,
    description: '广告',
  },
  {
    pattern: /公共汽车.*电车.*客运管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '公共交通',
  },
  {
    pattern: /地方志工作.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '地方志',
  },
  {
    pattern: /实施.*水法.*条例|实施.*水法.*办法/,
    category: LawCategory.ECONOMIC,
    description: '水法',
  },
  {
    pattern: /社区戒毒康复.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '社区戒毒',
  },
  {
    pattern: /流动人口.*服务管理.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '流动人口',
  },
  {
    pattern: /城市绿线.*管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '绿线管理',
  },
  {
    pattern: /环境保护税.*适用税额.*决定/,
    category: LawCategory.ECONOMIC,
    description: '环保税',
  },
  {
    pattern: /提高地方立法质量.*规定/,
    category: LawCategory.PROCEDURE,
    description: '立法质量',
  },
  {
    pattern: /东水济辽.*工程管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '东水济辽',
  },
  {
    pattern: /实施.*烟草专卖法.*办法/,
    category: LawCategory.ECONOMIC,
    description: '烟草专卖法',
  },
  {
    pattern: /.*人大常委会.*解释.*规定/,
    category: LawCategory.PROCEDURE,
    description: '人大解释',
  },
  {
    pattern: /深化.*平安建设.*决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '平安建设',
  },
  {
    pattern: /代表.*约见.*负责人.*办法/,
    category: LawCategory.PROCEDURE,
    description: '代表约见',
  },
  {
    pattern: /实施.*矿山安全法.*办法/,
    category: LawCategory.ECONOMIC,
    description: '矿山安全法',
  },
  {
    pattern:
      /.*人民代表大会.*主席团工作.*条例|.*人民代表大会.*主席团工作.*规定/,
    category: LawCategory.PROCEDURE,
    description: '主席团工作',
  },
  {
    pattern: /.*人民代表大会.*选举.*实施细则/,
    category: LawCategory.PROCEDURE,
    description: '选举细则',
  },
  {
    pattern: /.*人民代表大会.*工作.*若干规定/,
    category: LawCategory.PROCEDURE,
    description: '人大工作',
  },
  {
    pattern: /职业技能培训.*条例/,
    category: LawCategory.LABOR,
    description: '职业技能培训',
  },
  {
    pattern: /.*综合实验区.*条例/,
    category: LawCategory.ECONOMIC,
    description: '综合实验区',
  },
  {
    pattern: /.*人民代表大会.*常务委员会.*听取和审议.*规定/,
    category: LawCategory.PROCEDURE,
    description: '听取审议',
  },
  {
    pattern: /.*实施.*监督法.*办法/,
    category: LawCategory.PROCEDURE,
    description: '监督法',
  },

  // ============ 2026-02-18 最终批次补充规则 ============
  {
    pattern: /除四害.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '除四害',
  },
  {
    pattern: /地下热水.*管理办法|温泉.*管理办法/,
    category: LawCategory.ECONOMIC,
    description: '温泉管理',
  },
  {
    pattern: /城市道路建设与.*管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '道路建设',
  },
  {
    pattern: /寿山石.*资源保护.*办法/,
    category: LawCategory.ECONOMIC,
    description: '寿山石',
  },
  {
    pattern: /社会事业设施.*建设和保护.*规定/,
    category: LawCategory.ECONOMIC,
    description: '社会事业设施',
  },
  {
    pattern: /气象探测.*环境和设施保护.*规定/,
    category: LawCategory.ECONOMIC,
    description: '气象探测保护',
  },
  {
    pattern: /统计工作管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '统计工作',
  },
  {
    pattern: /行政服务.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '行政服务',
  },
  {
    pattern: /城市排水设施.*建设与管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '排水设施',
  },
  {
    pattern: /蘑菇菌种.*管理规定/,
    category: LawCategory.ECONOMIC,
    description: '蘑菇菌种',
  },
  {
    pattern: /统计.*规定/,
    category: LawCategory.ECONOMIC,
    description: '统计',
  },
  {
    pattern: /房屋产权产籍.*管理办法/,
    category: LawCategory.CIVIL,
    description: '产权产籍',
  },
  {
    pattern: /涉及国家安全事项.*建设.*管理条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '国家安全',
  },
  {
    pattern: /优化投资环境.*条例/,
    category: LawCategory.ECONOMIC,
    description: '投资环境',
  },
  {
    pattern: /山林权属争议.*调解处理.*办法/,
    category: LawCategory.PROCEDURE,
    description: '山林争议',
  },
  {
    pattern: /蔬菜质量安全.*管理办法/,
    category: LawCategory.ECONOMIC,
    description: '蔬菜质量',
  },
  {
    pattern: /错案责任追究.*条例/,
    category: LawCategory.PROCEDURE,
    description: '错案责任',
  },
  {
    pattern: /电视管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '电视管理',
  },
  {
    pattern: /结核病防治.*决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '结核病',
  },
  {
    pattern: /传染性非典型肺炎.*决议/,
    category: LawCategory.ADMINISTRATIVE,
    description: '非典',
  },
  {
    pattern: /确定土地权属.*条例/,
    category: LawCategory.ECONOMIC,
    description: '土地权属',
  },
  {
    pattern: /夏玉米制种.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '制种管理',
  },
  {
    pattern: /城市公有房屋.*管理条例/,
    category: LawCategory.CIVIL,
    description: '公有房屋',
  },
  {
    pattern: /计划生育.*管理办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '计划生育',
  },
  {
    pattern: /征地补偿安置.*条例/,
    category: LawCategory.ECONOMIC,
    description: '征地补偿',
  },
  {
    pattern: /行使职权的.*规定/,
    category: LawCategory.PROCEDURE,
    description: '人大常委会职权',
  },
  {
    pattern: /加强同.*代表.*联系.*办法/,
    category: LawCategory.PROCEDURE,
    description: '代表联系',
  },
  {
    pattern: /涉外项目.*国家安全.*管理条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '涉外安全',
  },
  {
    pattern: /体育设施.*管理条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '体育设施',
  },
  {
    pattern: /代表资格.*审查.*办法/,
    category: LawCategory.PROCEDURE,
    description: '代表审查',
  },
  {
    pattern: /流动人口.*管理条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '流动人口',
  },
  {
    pattern: /出租汽车.*管理条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '出租车',
  },
  {
    pattern: /使用.*老文字.*决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '老文字',
  },
  {
    pattern: /设立.*人民检察院.*决定/,
    category: LawCategory.PROCEDURE,
    description: '检察院设立',
  },
  {
    pattern: /开展.*直接选举.*决定/,
    category: LawCategory.PROCEDURE,
    description: '直接选举',
  },
  {
    pattern: /灾害事故应急处置.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '应急处置',
  },
  {
    pattern: /海钓安全管理.*规定/,
    category: LawCategory.ECONOMIC,
    description: '海钓安全',
  },
  {
    pattern: /金砖国家.*创新中心.*条例/,
    category: LawCategory.ECONOMIC,
    description: '金砖创新',
  },

  // ============ 2026-02-18 最后补充规则 ============
  {
    pattern: /地震观测环境保护.*决定/,
    category: LawCategory.PROCEDURE,
    description: '地震观测',
  },
  {
    pattern: /取水许可.*管理办法/,
    category: LawCategory.ECONOMIC,
    description: '取水许可',
  },
  {
    pattern: /综合改革试验.*决定/,
    category: LawCategory.PROCEDURE,
    description: '综合改革',
  },
  {
    pattern: /著作权.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '著作权',
  },
  {
    pattern: /万绿园.*保护管理.*规定/,
    category: LawCategory.ECONOMIC,
    description: '万绿园',
  },
  {
    pattern: /遗体.*器官捐献.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '器官捐献',
  },
  {
    pattern: /社会保障工作监督.*决定/,
    category: LawCategory.PROCEDURE,
    description: '社保监督',
  },
  {
    pattern: /台湾同胞捐赠.*管理办法/,
    category: LawCategory.ECONOMIC,
    description: '台胞捐赠',
  },
  {
    pattern: /重要水生动物.*苗种.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '水生动物',
  },
  {
    pattern: /禁止非法增加企业负担.*条例/,
    category: LawCategory.ECONOMIC,
    description: '企业减负',
  },
  {
    pattern: /社会救济.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '社会救济',
  },
  {
    pattern: /森林建设促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '森林建设',
  },
  {
    pattern: /.*经济区.*条例/,
    category: LawCategory.ECONOMIC,
    description: '经济区',
  },
  {
    pattern: /.*风光带.*条例/,
    category: LawCategory.ECONOMIC,
    description: '风光带',
  },
  {
    pattern: /再生资源回收管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '再生资源',
  },
  {
    pattern: /林权登记.*条例/,
    category: LawCategory.ECONOMIC,
    description: '林权登记',
  },
  {
    pattern: /高新技术促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '高新产业',
  },
  {
    pattern: /清洁生产促进.*办法/,
    category: LawCategory.ECONOMIC,
    description: '清洁生产',
  },
  {
    pattern: /反销赃.*条例/,
    category: LawCategory.ECONOMIC,
    description: '反销赃',
  },
  {
    pattern: /安全管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '安全管理',
  },
  {
    pattern: /性病防治.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '性病防治',
  },
  {
    pattern: /油区工作.*管理办法/,
    category: LawCategory.ECONOMIC,
    description: '油区管理',
  },
  {
    pattern: /刑事被害人.*特困救助.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '被害人救助',
  },
  {
    pattern: /禁止使用违禁药物.*决定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '禁止违禁药物',
  },
  {
    pattern: /汽车维修管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '汽车维修',
  },
  {
    pattern: /价格监督管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '价格监督',
  },
  {
    pattern: /促进开放.*条例/,
    category: LawCategory.ECONOMIC,
    description: '促进开放',
  },
  {
    pattern: /罚没财产.*管理规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '罚没财产',
  },
  {
    pattern: /私营企业.*条例/,
    category: LawCategory.ECONOMIC,
    description: '私营企业',
  },
  {
    pattern: /涉案财产价格鉴定.*条例/,
    category: LawCategory.PROCEDURE,
    description: '价格鉴定',
  },
  {
    pattern: /土地权属.*争议处理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '土地权属',
  },
  {
    pattern: /水库移民.*条例/,
    category: LawCategory.ECONOMIC,
    description: '水库移民',
  },
  {
    pattern: /限制.*塑料制品.*规定/,
    category: LawCategory.ECONOMIC,
    description: '限塑',
  },
  {
    pattern: /采石取土.*管理规定/,
    category: LawCategory.ECONOMIC,
    description: '采石取土',
  },
  {
    pattern: /林木林地权属争议.*处理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '林地争议',
  },
  {
    pattern: /大型群众性活动安全管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '大型活动安全',
  },
  {
    pattern: /村级道路.*管理养护.*条例/,
    category: LawCategory.ECONOMIC,
    description: '村级道路',
  },
  {
    pattern: /动物重大疫病.*免疫.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '动物疫病',
  },
  {
    pattern: /蔬菜农药残留.*监督管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '农药残留',
  },
  // 经济特区法规
  {
    pattern: /深圳经济特区|汕头经济特区|厦门经济特区|珠海经济特区|海南经济特区/,
    category: LawCategory.ECONOMIC,
    description: '经济特区法规',
  },
  {
    pattern: /深圳国际仲裁院.*条例/,
    category: LawCategory.PROCEDURE,
    description: '仲裁院条例',
  },
  {
    pattern: /人民代表大会常务委员会.*关于.*的决定$/,
    category: LawCategory.PROCEDURE,
    description: '人大决定',
  },
  {
    pattern: /.*人民代表大会常务委员会.*决定$/,
    category: LawCategory.PROCEDURE,
    description: '地方人大决定',
  },
  {
    pattern: /.*经济特区.*规定$/,
    category: LawCategory.ECONOMIC,
    description: '经济特区规定',
  },
  {
    pattern: /.*经济特区.*条例$/,
    category: LawCategory.ECONOMIC,
    description: '经济特区条例',
  },
  {
    pattern: /.*经济特区.*管理办法$/,
    category: LawCategory.ECONOMIC,
    description: '经济特区管理办法',
  },
  {
    pattern: /深圳经济特区.*人才工作.*/,
    category: LawCategory.LABOR,
    description: '人才工作条例',
  },
  {
    pattern: /深圳经济特区.*医疗.*/,
    category: LawCategory.CIVIL,
    description: '医疗条例',
  },
  {
    pattern: /深圳经济特区.*居住证.*/,
    category: LawCategory.ADMINISTRATIVE,
    description: '居住证条例',
  },
  {
    pattern: /深圳经济特区.*个人破产.*/,
    category: LawCategory.ECONOMIC,
    description: '个人破产条例',
  },
  {
    pattern: /深圳经济特区.*职业技能鉴定.*/,
    category: LawCategory.LABOR,
    description: '职业技能鉴定条例',
  },
  {
    pattern: /深圳经济特区.*城市园林.*/,
    category: LawCategory.ECONOMIC,
    description: '城市园林条例',
  },
  {
    pattern: /深圳经济特区.*土地使用权.*/,
    category: LawCategory.ECONOMIC,
    description: '土地使用权条例',
  },
  {
    pattern: /深圳经济特区.*技术转移.*/,
    category: LawCategory.ECONOMIC,
    description: '技术转移条例',
  },
  {
    pattern: /深圳经济特区.*救助人权益.*/,
    category: LawCategory.CIVIL,
    description: '救助人权益保护',
  },
  {
    pattern: /深圳经济特区.*碳排放管理.*/,
    category: LawCategory.ECONOMIC,
    description: '碳排放管理',
  },
  {
    pattern: /深圳经济特区.*电梯使用安全.*/,
    category: LawCategory.ADMINISTRATIVE,
    description: '电梯安全',
  },
  {
    pattern: /深圳经济特区.*全面禁止食用野生动物.*/,
    category: LawCategory.ECONOMIC,
    description: '野生动物保护',
  },
  {
    pattern: /深圳经济特区.*严厉打击.*假冒.*伪劣.*/,
    category: LawCategory.ADMINISTRATIVE,
    description: '打击假冒伪劣',
  },
  {
    pattern: /汕头经济特区.*残疾人扶助.*/,
    category: LawCategory.CIVIL,
    description: '残疾人扶助',
  },
  {
    pattern: /汕头经济特区.*保障妇女权益.*/,
    category: LawCategory.CIVIL,
    description: '妇女权益保障',
  },
  {
    pattern: /汕头经济特区.*预防腐败.*/,
    category: LawCategory.ADMINISTRATIVE,
    description: '预防腐败',
  },
  {
    pattern: /汕头经济特区.*城市公共汽车.*/,
    category: LawCategory.ECONOMIC,
    description: '城市公共交通',
  },
  {
    pattern: /海南经济特区.*海岸带.*/,
    category: LawCategory.ECONOMIC,
    description: '海岸带保护',
  },
  {
    pattern: /海南经济特区.*农垦.*/,
    category: LawCategory.ECONOMIC,
    description: '农垦条例',
  },
  {
    pattern: /海南经济特区.*集体林地.*/,
    category: LawCategory.ECONOMIC,
    description: '林地流转',
  },
  {
    pattern: /海南经济特区.*换地权益书.*/,
    category: LawCategory.ECONOMIC,
    description: '换地权益书',
  },
  {
    pattern: /深圳市.*土地.*征用.*收回.*/,
    category: LawCategory.ECONOMIC,
    description: '土地征用收回',
  },
  {
    pattern: /深圳市人民代表大会常务委员会.*/,
    category: LawCategory.PROCEDURE,
    description: '深圳市人大决定',
  },
  {
    pattern: /海南省人民代表大会常务委员会.*/,
    category: LawCategory.PROCEDURE,
    description: '海南省人大决定',
  },
  {
    pattern: /山东省人民代表大会常务委员会.*/,
    category: LawCategory.PROCEDURE,
    description: '山东省人大决定',
  },
  {
    pattern: /深圳经济特区.*健康.*/,
    category: LawCategory.CIVIL,
    description: '健康条例',
  },
  {
    pattern: /深圳经济特区.*互联网租赁自行车.*/,
    category: LawCategory.ECONOMIC,
    description: '互联网租赁自行车',
  },
  {
    pattern: /深圳经济特区.*失业保险.*/,
    category: LawCategory.LABOR,
    description: '失业保险',
  },
  {
    pattern: /深圳经济特区.*预防与化解纠纷.*/,
    category: LawCategory.PROCEDURE,
    description: '纠纷预防化解',
  },
  {
    pattern: /厦门经济特区.*土地节约集约利用.*/,
    category: LawCategory.ECONOMIC,
    description: '土地节约利用',
  },
  {
    pattern: /珠海经济特区.*社会建设.*/,
    category: LawCategory.ECONOMIC,
    description: '社会建设',
  },
  {
    pattern: /珠海经济特区.*预防腐败.*/,
    category: LawCategory.ADMINISTRATIVE,
    description: '预防腐败',
  },
  {
    pattern: /珠海经济特区.*人才开发促进.*/,
    category: LawCategory.LABOR,
    description: '人才开发促进',
  },
  {
    pattern: /深圳市.*城市规划.*/,
    category: LawCategory.ADMINISTRATIVE,
    description: '城市规划',
  },
  // 军人权益保障
  {
    pattern: /军人地位和权益保障.*条例/,
    category: LawCategory.LABOR,
    description: '军人权益保障',
  },
  // 社会保险
  {
    pattern: /社会保险基金监管.*条例/,
    category: LawCategory.LABOR,
    description: '社保基金监管',
  },
  // 环境保护
  {
    pattern: /重污染天气.*防治.*/,
    category: LawCategory.ECONOMIC,
    description: '重污染天气防治',
  },
  {
    pattern: /清洁取暖.*促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '清洁取暖',
  },
  {
    pattern: /野生动物放生.*管理.*/,
    category: LawCategory.ECONOMIC,
    description: '野生动物管理',
  },
  // 城市管理
  {
    pattern: /路面防滑.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '路面防滑',
  },
  {
    pattern: /风貌管控.*/,
    category: LawCategory.ADMINISTRATIVE,
    description: '风貌管控',
  },
  {
    pattern: /违法小广告.*查处.*/,
    category: LawCategory.ADMINISTRATIVE,
    description: '违法小广告查处',
  },
  {
    pattern: /门前责任区.*管理.*/,
    category: LawCategory.ADMINISTRATIVE,
    description: '门前责任区',
  },
  {
    pattern: /城市照明.*管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '城市照明管理',
  },
  {
    pattern: /城市公共厕所.*/,
    category: LawCategory.ADMINISTRATIVE,
    description: '公共厕所管理',
  },
  {
    pattern: /城市道路.*限制交通.*/,
    category: LawCategory.ADMINISTRATIVE,
    description: '道路限制交通',
  },
  // 社会心理服务
  {
    pattern: /社会心理服务.*条例/,
    category: LawCategory.CIVIL,
    description: '社会心理服务',
  },
  // 食品安全
  {
    pattern: /食品安全数字化.*追溯.*/,
    category: LawCategory.ECONOMIC,
    description: '食品安全追溯',
  },
  // 海绵城市
  {
    pattern: /海绵城市.*条例/,
    category: LawCategory.ECONOMIC,
    description: '海绵城市',
  },
  // 行政审批
  {
    pattern: /行政审批.*监督管理.*协同联动.*/,
    category: LawCategory.ADMINISTRATIVE,
    description: '行政审批监管',
  },
  {
    pattern: /优化行政审批.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '优化行政审批',
  },
  // 精神障碍救助
  {
    pattern: /严重精神障碍.*救助保障.*/,
    category: LawCategory.CIVIL,
    description: '精神障碍救助',
  },
  // 资源管理
  {
    pattern: /查处非法开采.*海砂.*/,
    category: LawCategory.ECONOMIC,
    description: '查处非法采砂',
  },
  // 餐饮浪费
  {
    pattern: /制止餐饮浪费.*/,
    category: LawCategory.ECONOMIC,
    description: '制止餐饮浪费',
  },
  {
    pattern: /反食品浪费.*规定/,
    category: LawCategory.ECONOMIC,
    description: '反食品浪费',
  },
  // 移风易俗
  {
    pattern: /移风易俗.*条例/,
    category: LawCategory.CIVIL,
    description: '移风易俗',
  },
  // 粮食储备
  {
    pattern: /地方储备粮.*管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '地方储备粮',
  },
  // 集体协商
  {
    pattern: /集体协商.*条例/,
    category: LawCategory.LABOR,
    description: '集体协商',
  },
  // 内蒙古促进条例
  {
    pattern: /全方位建设模范自治区.*促进.*/,
    category: LawCategory.ADMINISTRATIVE,
    description: '模范自治区建设',
  },
  {
    pattern: /农畜产品生产基地.*促进.*/,
    category: LawCategory.ECONOMIC,
    description: '农畜产品基地',
  },
  {
    pattern: /向北开放.*桥头堡.*促进.*/,
    category: LawCategory.ECONOMIC,
    description: '向北开放',
  },
  {
    pattern: /生态安全屏障.*促进.*/,
    category: LawCategory.ECONOMIC,
    description: '生态安全屏障',
  },
  {
    pattern: /安全稳定屏障.*促进.*/,
    category: LawCategory.ADMINISTRATIVE,
    description: '安全稳定屏障',
  },
  // 人大工作
  {
    pattern: /人民代表大会代表.*议案处理.*/,
    category: LawCategory.PROCEDURE,
    description: '代表议案处理',
  },
  {
    pattern: /人民代表大会常务委员会工作.*条例/,
    category: LawCategory.PROCEDURE,
    description: '人大常委会工作',
  },
  {
    pattern: /人民代表大会关于.*建议.*批评.*意见.*规定/,
    category: LawCategory.PROCEDURE,
    description: '代表建议规定',
  },
  // 登山
  {
    pattern: /登山.*条例/,
    category: LawCategory.ECONOMIC,
    description: '登山管理',
  },
  // 出租车管理
  {
    pattern: /出租汽车.*经营服务.*管理.*/,
    category: LawCategory.ECONOMIC,
    description: '出租车管理',
  },
  {
    pattern: /客运出租汽车.*管理.*/,
    category: LawCategory.ECONOMIC,
    description: '客运出租车',
  },
  // 医疗/疾病防治
  {
    pattern: /包虫病.*防治.*条例/,
    category: LawCategory.CIVIL,
    description: '包虫病防治',
  },
  {
    pattern: /职业病防治.*若干规定/,
    category: LawCategory.LABOR,
    description: '职业病防治',
  },
  // 民族医药
  {
    pattern: /民族民间医药.*保护和促进.*/,
    category: LawCategory.CIVIL,
    description: '民族民间医药',
  },
  // 数字化转型
  {
    pattern: /数字化转型.*促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '数字化转型',
  },
  // 城市社区建设
  {
    pattern: /城市社区建设.*促进.*条例/,
    category: LawCategory.CIVIL,
    description: '城市社区建设',
  },
  // 版权
  {
    pattern: /版权.*条例/,
    category: LawCategory.INTELLECTUAL_PROPERTY,
    description: '版权条例',
  },
  // 农田防护林
  {
    pattern: /农田防护林.*建设.*管理.*/,
    category: LawCategory.ECONOMIC,
    description: '农田防护林',
  },
  // 禁止携带手机
  {
    pattern: /禁止.*携带手机.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '禁止手机规定',
  },
  // 文明乡村
  {
    pattern: /文明乡村.*条例/,
    category: LawCategory.CIVIL,
    description: '文明乡村',
  },
  // 哲学社会科学
  {
    pattern: /哲学社会科学促进.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '哲学社会科学',
  },
  // 新型工业化
  {
    pattern: /新型工业化促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '新型工业化',
  },
  // 文化遗产保护
  {
    pattern: /保护利用.*条例/,
    category: LawCategory.CIVIL,
    description: '文化遗产保护',
  },
  // 公筷使用
  {
    pattern: /公筷.*使用.*规定/,
    category: LawCategory.ECONOMIC,
    description: '公筷使用',
  },
  // 献血
  {
    pattern: /献血.*办法/,
    category: LawCategory.CIVIL,
    description: '献血管理',
  },
  // 体育法实施
  {
    pattern: /实施.*体育法.*若干规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '体育法实施',
  },
  // 产业科创
  {
    pattern: /产业科创促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '产业科创促进',
  },
  // 产业工人
  {
    pattern: /产业工人服务.*条例/,
    category: LawCategory.LABOR,
    description: '产业工人服务',
  },
  // 停车
  {
    pattern: /停车.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '停车管理',
  },
  // 粤港澳合作
  {
    pattern: /粤港澳全面合作.*条例/,
    category: LawCategory.ECONOMIC,
    description: '粤港澳合作',
  },
  // 国际贸易
  {
    pattern: /国际贸易中心建设.*条例/,
    category: LawCategory.ECONOMIC,
    description: '国际贸易中心',
  },
  // 酒类商品
  {
    pattern: /酒类商品.*产销管理.*/,
    category: LawCategory.ECONOMIC,
    description: '酒类产销管理',
  },
  // 商品包装减量
  {
    pattern: /商品包装物减量.*/,
    category: LawCategory.ECONOMIC,
    description: '商品包装减量',
  },
  // 智能网联汽车
  {
    pattern: /智能网联汽车.*管理办法/,
    category: LawCategory.ECONOMIC,
    description: '智能网联汽车',
  },
  // 污水排放
  {
    pattern: /城市生活污水排放.*管理.*/,
    category: LawCategory.ECONOMIC,
    description: '污水排放管理',
  },
  // 花园城市促进
  {
    pattern: /国际花园城市促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '花园城市促进',
  },
  // 通用航空
  {
    pattern: /通用航空.*条例/,
    category: LawCategory.ECONOMIC,
    description: '通用航空',
  },
  // 任免国家机关工作人员
  {
    pattern: /任免国家机关工作人员.*办法/,
    category: LawCategory.PROCEDURE,
    description: '任免工作人员',
  },
  // 不动产登记
  {
    pattern: /不动产登记.*条例/,
    category: LawCategory.ECONOMIC,
    description: '不动产登记',
  },
  // 露天烧烤
  {
    pattern: /经营性露天烧烤.*管理.*/,
    category: LawCategory.ADMINISTRATIVE,
    description: '露天烧烤管理',
  },
  // 立法征求意见
  {
    pattern: /立法征求意见.*工作.*规定/,
    category: LawCategory.PROCEDURE,
    description: '立法征求意见',
  },
  // 国民经济计划
  {
    pattern: /国民经济和社会发展计划.*审查监督.*/,
    category: LawCategory.ECONOMIC,
    description: '国民经济计划',
  },
  // 湖泊保护
  {
    pattern: /.*湖.*保护.*治理.*/,
    category: LawCategory.ECONOMIC,
    description: '湖泊保护治理',
  },
  // 实施慈善法
  {
    pattern: /实施.*慈善法.*若干规定.*办法/,
    category: LawCategory.CIVIL,
    description: '慈善法实施',
  },
  // 引水工程
  {
    pattern: /.*引水工程.*管理.*/,
    category: LawCategory.ECONOMIC,
    description: '引水工程管理',
  },
  // 医疗纠纷
  {
    pattern: /医疗纠纷.*预防与处理.*条例/,
    category: LawCategory.CIVIL,
    description: '医疗纠纷处理',
  },
  // 人民建议征集
  {
    pattern: /人民建议征集.*规定/,
    category: LawCategory.PROCEDURE,
    description: '人民建议征集',
  },
  // 创新型省份建设
  {
    pattern: /创新型省份建设.*促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '创新型省份建设',
  },
  // 健康乡村
  {
    pattern: /健康乡村.*条例/,
    category: LawCategory.CIVIL,
    description: '健康乡村',
  },
  // 地方粮食储备管理
  {
    pattern: /地方粮食储备.*管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '地方粮食储备',
  },
  // 菜市场管理
  {
    pattern: /菜市场.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '菜市场管理',
  },
  // 一枚印章管审批
  {
    pattern: /一枚印章管审批.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '一枚印章管审批',
  },
  // 直接选举细则
  {
    pattern: /直接选举.*细则/,
    category: LawCategory.PROCEDURE,
    description: '直接选举',
  },
  // 废旧农膜回收
  {
    pattern: /废旧农膜回收利用.*条例/,
    category: LawCategory.ECONOMIC,
    description: '废旧农膜回收',
  },
  // 公示法规草案
  {
    pattern: /公示.*地方性法规草案.*规定/,
    category: LawCategory.PROCEDURE,
    description: '公示法规草案',
  },
  // 村庄规划
  {
    pattern: /村庄规划.*村民建房.*管理.*/,
    category: LawCategory.ADMINISTRATIVE,
    description: '村庄规划',
  },
  // 疾病防治
  {
    pattern: /.*热病.*防治.*规定/,
    category: LawCategory.CIVIL,
    description: '疾病防治',
  },
  // 体育设施
  {
    pattern: /体育设施.*建设.*管理.*/,
    category: LawCategory.CIVIL,
    description: '体育设施',
  },
  // 城市大脑
  {
    pattern: /城市大脑.*城市治理.*促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '城市大脑治理',
  },
  // 村容村貌
  {
    pattern: /村容村貌.*管理.*条例/,
    category: LawCategory.CIVIL,
    description: '村容村貌',
  },
  // 补充养老保险
  {
    pattern: /补充养老保险.*条例/,
    category: LawCategory.LABOR,
    description: '补充养老保险',
  },
  // 政务数据
  {
    pattern: /政务数据.*管理与应用.*/,
    category: LawCategory.ADMINISTRATIVE,
    description: '政务数据管理',
  },
  // 突发事件应急保障
  {
    pattern: /突发事件应急保障.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '突发事件应急',
  },
  // 砂石土资源
  {
    pattern: /砂.*石.*土资源.*管理.*规定/,
    category: LawCategory.ECONOMIC,
    description: '砂石土资源',
  },
  // 预防接种管理
  {
    pattern: /预防接种.*管理条例/,
    category: LawCategory.CIVIL,
    description: '预防接种',
  },
  // 社区发展治理
  {
    pattern: /社区发展治理.*促进.*条例/,
    category: LawCategory.CIVIL,
    description: '社区治理',
  },
  // 禁止含磷洗涤用品
  {
    pattern: /禁止生产销售使用含磷洗涤用品.*条例/,
    category: LawCategory.ECONOMIC,
    description: '含磷洗涤用品',
  },
  // 美丽乡村
  {
    pattern: /美丽乡村.*条例/,
    category: LawCategory.CIVIL,
    description: '美丽乡村',
  },
  // 实施中医药法
  {
    pattern: /实施.*中医药法.*办法/,
    category: LawCategory.CIVIL,
    description: '中医药法实施',
  },
  // 厉行节约反对餐饮浪费
  {
    pattern: /厉行节约.*反对餐饮浪费.*规定/,
    category: LawCategory.ECONOMIC,
    description: '厉行节约',
  },
  // 实施资源税法
  {
    pattern: /实施资源税法.*授权事项.*/,
    category: LawCategory.ECONOMIC,
    description: '资源税法实施',
  },
  // 村经济合作社
  {
    pattern: /村经济合作社.*组织.*条例/,
    category: LawCategory.ECONOMIC,
    description: '村经济合作社',
  },
  // 现场救护
  {
    pattern: /现场救护.*条例/,
    category: LawCategory.CIVIL,
    description: '现场救护',
  },
  // 土地开发整理
  {
    pattern: /土地开发整理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '土地开发整理',
  },
  // 拥军优属
  {
    pattern: /拥军优属.*规定/,
    category: LawCategory.LABOR,
    description: '拥军优属',
  },
  // 反餐饮浪费
  {
    pattern: /反餐饮浪费.*/,
    category: LawCategory.ECONOMIC,
    description: '反餐饮浪费',
  },
  // 人大代表工作
  {
    pattern: /人民代表大会代表工作.*条例/,
    category: LawCategory.PROCEDURE,
    description: '人大代表工作',
  },
  // 禁止赌博
  {
    pattern: /禁止赌博.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '禁止赌博',
  },
  // 高标准农田
  {
    pattern: /高标准农田.*建设管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '高标准农田',
  },
  // 和美乡村
  {
    pattern: /和美乡村.*条例/,
    category: LawCategory.CIVIL,
    description: '和美乡村',
  },
  // 眼角膜捐献
  {
    pattern: /眼角膜捐献.*条例/,
    category: LawCategory.CIVIL,
    description: '眼角膜捐献',
  },
  // 丧葬祭奠物品
  {
    pattern: /焚烧抛撒丧葬祭奠物品.*规定/,
    category: LawCategory.CIVIL,
    description: '丧葬祭奠管理',
  },
  // 医疗废物
  {
    pattern: /医疗废物.*管理.*规定/,
    category: LawCategory.ECONOMIC,
    description: '医疗废物管理',
  },
  // 并联审批
  {
    pattern: /并联审批.*管理.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '并联审批',
  },
  // 医院安全秩序
  {
    pattern: /医院安全秩序.*管理.*规定/,
    category: LawCategory.CIVIL,
    description: '医院安全秩序',
  },
  // 经济林发展
  {
    pattern: /经济林发展.*条例/,
    category: LawCategory.ECONOMIC,
    description: '经济林发展',
  },
  // 禁止随地吐痰
  {
    pattern: /禁止.*随地吐痰.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '禁止随地吐痰',
  },
  // 餐饮业油烟
  {
    pattern: /餐饮业油烟.*管理办法/,
    category: LawCategory.ADMINISTRATIVE,
    description: '餐饮油烟管理',
  },
  // 防雷减灾
  {
    pattern: /防雷减灾.*条例/,
    category: LawCategory.ECONOMIC,
    description: '防雷减灾',
  },
  // 河湖长制
  {
    pattern: /河.*湖长制.*条例/,
    category: LawCategory.ECONOMIC,
    description: '河湖长制',
  },
  // 人大常委会解释
  {
    pattern: /人大常委会.*解释$/,
    category: LawCategory.PROCEDURE,
    description: '人大常委会解释',
  },
  // 流动人口居住登记
  {
    pattern: /流动人口居住登记.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '流动人口登记',
  },
  // 乡镇人大
  {
    pattern: /乡镇人民代表大会.*条例/,
    category: LawCategory.PROCEDURE,
    description: '乡镇人大',
  },
  // 动物检疫监督
  {
    pattern: /动物.*产品检疫监督.*条例/,
    category: LawCategory.ECONOMIC,
    description: '动物检疫',
  },
  // 台湾同胞投资
  {
    pattern: /保护和促进.*台湾同胞投资.*条例/,
    category: LawCategory.ECONOMIC,
    description: '台胞投资保护',
  },
  // 智慧经济促进
  {
    pattern: /智慧经济促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '智慧经济',
  },
  // 城乡生活垃圾处理
  {
    pattern: /城乡生活垃圾处理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '生活垃圾处理',
  },
  // 人大代表补选
  {
    pattern: /人民代表大会代表补选.*办法/,
    category: LawCategory.PROCEDURE,
    description: '代表补选',
  },
  // 集贸市场管理
  {
    pattern: /集贸市场.*管理.*条例/,
    category: LawCategory.ECONOMIC,
    description: '集贸市场管理',
  },
  // 著名商标
  {
    pattern: /著名商标.*认定和促进.*条例/,
    category: LawCategory.INTELLECTUAL_PROPERTY,
    description: '著名商标',
  },
  // 假冒伪劣商品
  {
    pattern: /禁止.*生产.*销售假冒伪劣商品.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '打击假冒伪劣',
  },
  // 城市公共客运
  {
    pattern: /城市公共客运.*条例/,
    category: LawCategory.ECONOMIC,
    description: '城市公共客运',
  },
  // 民用机场管理
  {
    pattern: /民用机场.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '机场管理',
  },
  // 南水北调
  {
    pattern: /南水北调.*条例/,
    category: LawCategory.ECONOMIC,
    description: '南水北调',
  },
  // 非煤矿山管理
  {
    pattern: /非煤矿山.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '非煤矿山',
  },
  // 港澳同胞投资
  {
    pattern: /保护和促进.*香港.*澳门同胞投资.*条例/,
    category: LawCategory.ECONOMIC,
    description: '港澳同胞投资',
  },
  // 科技人才创业
  {
    pattern: /科技人才创业.*特别.*条例/,
    category: LawCategory.ECONOMIC,
    description: '科技人才创业',
  },
  // 公共体育设施
  {
    pattern: /公共体育设施.*条例/,
    category: LawCategory.CIVIL,
    description: '公共体育设施',
  },
  // 查处非法客运
  {
    pattern: /查处车辆非法客运.*规定/,
    category: LawCategory.ADMINISTRATIVE,
    description: '查处非法客运',
  },
  // 生态补偿
  {
    pattern: /生态补偿.*条例/,
    category: LawCategory.ECONOMIC,
    description: '生态补偿',
  },
  // 资源增殖保护
  {
    pattern: /资源增殖保护.*管理.*规定/,
    category: LawCategory.ECONOMIC,
    description: '资源增殖保护',
  },
  // 民间融资管理
  {
    pattern: /民间融资.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '民间融资',
  },
  // 循环经济促进法
  {
    pattern: /实施.*循环经济促进法.*办法/,
    category: LawCategory.ECONOMIC,
    description: '循环经济实施',
  },
  // 人大常委会专题询问
  {
    pattern: /人民代表大会常务委员会专题询问.*办法/,
    category: LawCategory.PROCEDURE,
    description: '专题询问',
  },
  // 人口服务管理
  {
    pattern: /人口服务管理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '人口服务管理',
  },
  // 城市治理
  {
    pattern: /城市治理.*条例/,
    category: LawCategory.ADMINISTRATIVE,
    description: '城市治理',
  },
  // 食品生产加工小作坊
  {
    pattern: /食品生产加工小作坊.*管理办法/,
    category: LawCategory.ECONOMIC,
    description: '食品小作坊',
  },
  // 国家级基本法律（国界法、监察法等）
  {
    pattern:
      /陆地国界法|监察官法|反外国制裁法|外国中央银行财产司法强制措施豁免法/,
    category: LawCategory.PROCEDURE,
    description: '国家级基本法律',
  },
  // 人大选举/协商方案
  {
    pattern: /台湾省出席.*全国人民代表大会代表协商选举方案/,
    category: LawCategory.PROCEDURE,
    description: '人大选举方案',
  },
  // 武警部队改革
  {
    pattern: /中国人民武装警察部队改革期间.*调整适用.*决定/,
    category: LawCategory.PROCEDURE,
    description: '武警改革决定',
  },
  // 调整完善生育政策
  {
    pattern: /调整完善生育政策.*决议/,
    category: LawCategory.CIVIL,
    description: '生育政策决议',
  },
  // 批准设立直辖市
  {
    pattern: /关于批准设立.*直辖市的决定/,
    category: LawCategory.PROCEDURE,
    description: '设立直辖市',
  },
  // 加强法律解释
  {
    pattern: /加强法律解释工作.*决议/,
    category: LawCategory.PROCEDURE,
    description: '法律解释决议',
  },
  // 批准领海声明
  {
    pattern: /批准.*领海声明.*决议/,
    category: LawCategory.PROCEDURE,
    description: '领海声明决议',
  },
  // 实施统计法
  {
    pattern: /实施.*统计法.*办法/,
    category: LawCategory.ECONOMIC,
    description: '统计法实施',
  },
  // 公共体育设施管理
  {
    pattern: /公共体育设施.*管理办法$/,
    category: LawCategory.CIVIL,
    description: '公共体育设施',
  },
  // 城市客运交通
  {
    pattern: /城市客运交通.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '城市客运交通',
  },
  // 慈善促进
  {
    pattern: /慈善促进.*若干规定/,
    category: LawCategory.CIVIL,
    description: '慈善促进',
  },
  // 农田机井沟渠管护
  {
    pattern: /农田机井沟渠管护.*条例/,
    category: LawCategory.ECONOMIC,
    description: '农田设施管护',
  },
  // 现代企业制度建设促进
  {
    pattern: /现代企业制度建设促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '现代企业制度',
  },
  // 智慧城市促进
  {
    pattern: /智慧.*促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '智慧城市促进',
  },
  // 绿色航运
  {
    pattern: /绿色航运.*条例/,
    category: LawCategory.ECONOMIC,
    description: '绿色航运',
  },
  // 野生药用植物
  {
    pattern: /野生药用植物.*保护与利用.*条例/,
    category: LawCategory.CIVIL,
    description: '野生药用植物',
  },
  // 任免工作办法
  {
    pattern: /任免工作.*办法$/,
    category: LawCategory.PROCEDURE,
    description: '任免工作办法',
  },
  // 野生鸟类保护
  {
    pattern: /野生鸟类保护.*规定/,
    category: LawCategory.ECONOMIC,
    description: '野生鸟类保护',
  },
  // 废弃食用菌包
  {
    pattern: /废弃食用菌包.*污染环境防治.*条例/,
    category: LawCategory.ECONOMIC,
    description: '废弃菌包防治',
  },
  // 租赁住房管理
  {
    pattern: /租赁住房.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '租赁住房',
  },
  // 博物馆条例
  {
    pattern: /博物馆.*条例$/,
    category: LawCategory.CIVIL,
    description: '博物馆',
  },
  // 互联网租赁自行车
  {
    pattern: /互联网租赁自行车.*投放停放管理.*规定/,
    category: LawCategory.ECONOMIC,
    description: '共享单车管理',
  },
  // 地质灾害防治
  {
    pattern: /地质灾害预防和治理.*.*条例/,
    category: LawCategory.ECONOMIC,
    description: '地质灾害防治',
  },
  // 民宿业促进
  {
    pattern: /民宿业促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '民宿业促进',
  },
  // 低空经济促进
  {
    pattern: /低空经济促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '低空经济',
  },
  // 实施粮食安全保障法
  {
    pattern: /实施.*粮食安全保障法.*办法/,
    category: LawCategory.ECONOMIC,
    description: '粮食安全法实施',
  },
  // 饮用水水源保护
  {
    pattern: /.*饮用水水源.*规定$/,
    category: LawCategory.ECONOMIC,
    description: '饮用水水源',
  },
  // 乌兰牧骑
  {
    pattern: /乌兰牧骑.*条例$/,
    category: LawCategory.CIVIL,
    description: '乌兰牧骑',
  },
  // 学生心理健康
  {
    pattern: /促进学生心理健康.*条例/,
    category: LawCategory.CIVIL,
    description: '学生心理健康',
  },
  // 水库库区管理
  {
    pattern: /.*库区周边.*管理条例/,
    category: LawCategory.ECONOMIC,
    description: '库区管理',
  },
  // 精神传承
  {
    pattern: /传承弘扬.*精神.*条例/,
    category: LawCategory.CIVIL,
    description: '精神传承',
  },
  // 物业服务监督
  {
    pattern: /住宅小区物业服务监督.*若干规定/,
    category: LawCategory.CIVIL,
    description: '物业服务监督',
  },
  // 秸秆焚烧管理
  {
    pattern: /秸秆.*焚烧管理和综合利用.*规定/,
    category: LawCategory.ECONOMIC,
    description: '秸秆管理',
  },
  // 基层法治建设
  {
    pattern: /基层法治建设.*条例/,
    category: LawCategory.PROCEDURE,
    description: '基层法治建设',
  },
  // 社区体育健身设施
  {
    pattern: /城乡社区.*体育健身设施.*管理规定/,
    category: LawCategory.CIVIL,
    description: '社区体育设施',
  },
  // 砂石资源管理
  {
    pattern: /砂石资源.*管理规定$/,
    category: LawCategory.ECONOMIC,
    description: '砂石资源',
  },
  // 税费保障
  {
    pattern: /税费保障.*条例$/,
    category: LawCategory.ECONOMIC,
    description: '税费保障',
  },
  // 品牌建设促进
  {
    pattern: /品牌建设促进.*条例/,
    category: LawCategory.ECONOMIC,
    description: '品牌建设',
  },
  // 城市数字治理
  {
    pattern: /城市数字治理.*若干规定/,
    category: LawCategory.ECONOMIC,
    description: '数字治理',
  },
  // 古树保护
  {
    pattern: /古树后备资源保护.*规定/,
    category: LawCategory.ECONOMIC,
    description: '古树保护',
  },
  // 大气污染协同防治
  {
    pattern: /大气污染协同防治.*条例$/,
    category: LawCategory.ECONOMIC,
    description: '大气污染防治',
  },
  // 宪法及宪法修正案
  {
    pattern: /中华人民共和国宪法.*修正案|中华人民共和国宪法\([0-9]+年\)/,
    category: LawCategory.PROCEDURE,
    description: '宪法修正案',
  },
  // 国家通用语言文字法
  {
    pattern: /国家通用语言文字法$/,
    category: LawCategory.CIVIL,
    description: '语言文字法',
  },
  // 外国国家豁免法
  {
    pattern: /外国国家豁免法$/,
    category: LawCategory.PROCEDURE,
    description: '外国国家豁免法',
  },
  // 对外关系法
  {
    pattern: /对外关系法$/,
    category: LawCategory.PROCEDURE,
    description: '对外关系法',
  },
  // 供电设施管理
  {
    pattern: /供电设施.*管理.*供电服务.*条例/,
    category: LawCategory.ECONOMIC,
    description: '供电服务',
  },
  // 智能网联汽车创新发展
  {
    pattern: /智能网联汽车.*创新发展.*条例/,
    category: LawCategory.ECONOMIC,
    description: '智能网联汽车',
  },
  // 产业有序转移
  {
    pattern: /促进产业有序转移.*条例/,
    category: LawCategory.ECONOMIC,
    description: '产业有序转移',
  },
  // 秸秆综合利用
  {
    pattern: /秸秆综合利用.*规定$/,
    category: LawCategory.ECONOMIC,
    description: '秸秆综合利用',
  },
  // 自动驾驶汽车
  {
    pattern: /自动驾驶汽车.*条例$/,
    category: LawCategory.ECONOMIC,
    description: '自动驾驶汽车',
  },
  // 农药包装废弃物
  {
    pattern: /农药包装废弃物.*回收处置.*条例/,
    category: LawCategory.ECONOMIC,
    description: '农药包装废弃物',
  },
  // 残疾人社会服务
  {
    pattern: /残疾人社会服务.*条例/,
    category: LawCategory.CIVIL,
    description: '残疾人社会服务',
  },
  // 托育服务
  {
    pattern: /托育服务.*条例$/,
    category: LawCategory.CIVIL,
    description: '托育服务',
  },
  // 工业遗产保护利用
  {
    pattern: /工业遗产.*保护和利用.*条例/,
    category: LawCategory.ECONOMIC,
    description: '工业遗产',
  },
  // 实施国家安全法
  {
    pattern: /实施.*国家安全法.*办法$/,
    category: LawCategory.PROCEDURE,
    description: '国安法实施',
  },
  // 婚假规定
  {
    pattern: /婚假.*规定$/,
    category: LawCategory.LABOR,
    description: '婚假规定',
  },
  // 公共汽电车客运管理
  {
    pattern: /公共汽电车客运.*管理条例$/,
    category: LawCategory.ECONOMIC,
    description: '公共汽电车',
  },
  // 查禁卖淫嫖娼
  {
    pattern: /查禁.*卖淫嫖娼.*条例$/,
    category: LawCategory.ADMINISTRATIVE,
    description: '查禁卖淫嫖娼',
  },
  // 生态城
  {
    pattern: /.*生态城.*条例$/,
    category: LawCategory.ECONOMIC,
    description: '生态城',
  },
  // 蔬菜基地
  {
    pattern: /蔬菜基地.*条例$/,
    category: LawCategory.ECONOMIC,
    description: '蔬菜基地',
  },
  // 台湾同胞投资鼓励
  {
    pattern: /.*鼓励.*台湾同胞投资.*办法$/,
    category: LawCategory.ECONOMIC,
    description: '台胞投资鼓励',
  },
  // 惩治伪劣商品
  {
    pattern: /惩治.*生产销售.*伪劣商品.*违法行为.*条例$/,
    category: LawCategory.ADMINISTRATIVE,
    description: '惩治伪劣商品',
  },
  // 老年人合法权益
  {
    pattern: /保障老年人合法权益.*规定$/,
    category: LawCategory.CIVIL,
    description: '老年人权益',
  },
  // 集贸市场管理
  {
    pattern: /集贸市场.*管理办法$/,
    category: LawCategory.ECONOMIC,
    description: '集贸市场',
  },
  // 道路货物运输
  {
    pattern: /道路货物运输.*管理条例$/,
    category: LawCategory.ECONOMIC,
    description: '道路货运',
  },
  // 基本菜田管理
  {
    pattern: /基本菜田.*管理办法$/,
    category: LawCategory.ECONOMIC,
    description: '基本菜田',
  },
  // 体育场所管理
  {
    pattern: /体育场所.*管理办法$/,
    category: LawCategory.CIVIL,
    description: '体育场所',
  },
  // 村集体财务管理
  {
    pattern: /村集体经济组织财务管理.*条例$/,
    category: LawCategory.ECONOMIC,
    description: '村集体财务',
  },
  // 垦区
  {
    pattern: /垦区.*条例$/,
    category: LawCategory.ECONOMIC,
    description: '垦区',
  },
  // 禁止假冒伪劣商品
  {
    pattern: /禁止.*生产经销假冒伪劣商品.*规定$/,
    category: LawCategory.ADMINISTRATIVE,
    description: '禁止假冒伪劣',
  },
  // 献血用血
  {
    pattern: /献血用血.*条例$/,
    category: LawCategory.CIVIL,
    description: '献血用血',
  },
  // 农药管理
  {
    pattern: /农药.*管理办法$/,
    category: LawCategory.ECONOMIC,
    description: '农药管理',
  },
  // 招收台湾学生
  {
    pattern: /招收台湾学生.*规定$/,
    category: LawCategory.ADMINISTRATIVE,
    description: '招收台湾学生',
  },
  // 惩治假冒伪劣行为
  {
    pattern: /惩治.*假冒伪劣商品.*行为.*条例$/,
    category: LawCategory.ADMINISTRATIVE,
    description: '假冒伪劣行为',
  },
  // 发展高新技术
  {
    pattern: /发展高新技术.*条例$/,
    category: LawCategory.ECONOMIC,
    description: '高新技术',
  },
  // 烟草专卖
  {
    pattern: /烟草专卖.*规定$/,
    category: LawCategory.ECONOMIC,
    description: '烟草专卖',
  },
  // 无障碍建设
  {
    pattern: /无障碍建设.*条例$/,
    category: LawCategory.CIVIL,
    description: '无障碍建设',
  },
  // 严禁卖淫嫖娼
  {
    pattern: /严禁卖淫嫖娼.*条例$/,
    category: LawCategory.ADMINISTRATIVE,
    description: '严禁卖淫嫖娼',
  },
  // 宪法（带年份）
  {
    pattern: /中华人民共和国宪法（[0-9]+年.*）/,
    category: LawCategory.PROCEDURE,
    description: '宪法文本',
  },
  // 城市公共汽电车客运条例
  {
    pattern: /城市公共汽电车客运条例$/,
    category: LawCategory.ECONOMIC,
    description: '公共汽电车客运',
  },
  // 酒类生产流通管理
  {
    pattern: /酒类生产流通管理条例$/,
    category: LawCategory.ECONOMIC,
    description: '酒类管理',
  },
  // 人大常委会听取审议专项工作报告
  {
    pattern: /人民代表大会常务委员会听取和审议专项工作报告条例$/,
    category: LawCategory.PROCEDURE,
    description: '人大听取审议',
  },
  // 人大代表议案工作规则
  {
    pattern: /人民代表大会代表议案工作规则$/,
    category: LawCategory.PROCEDURE,
    description: '代表议案',
  },
  // 耕地质量管理
  {
    pattern: /耕地质量管理条例$/,
    category: LawCategory.ECONOMIC,
    description: '耕地质量',
  },
  // 查处无证无照经营
  {
    pattern: /查处无证无照经营行为条例$/,
    category: LawCategory.ADMINISTRATIVE,
    description: '查处无照经营',
  },
  // 质量检验机构管理
  {
    pattern: /质量检验机构管理条例$/,
    category: LawCategory.ECONOMIC,
    description: '质量检验',
  },
  // 企业信用信息公开
  {
    pattern: /企业信用信息公开条例$/,
    category: LawCategory.ECONOMIC,
    description: '企业信用',
  },
  // 法律法规实施情况检查监督
  {
    pattern: /加强对法律法规实施情况检查监督.*规定$/,
    category: LawCategory.PROCEDURE,
    description: '法律法规检查',
  },
  // 城市道路井盖设施
  {
    pattern: /城市道路井盖设施管理规定$/,
    category: LawCategory.ADMINISTRATIVE,
    description: '道路井盖',
  },
  // 道路货运市场管理
  {
    pattern: /道路货运市场管理条例$/,
    category: LawCategory.ECONOMIC,
    description: '道路货运',
  },
  // 居住区配套设施建设
  {
    pattern: /居住区配套设施建设管理条例$/,
    category: LawCategory.ECONOMIC,
    description: '配套设施',
  },
  // 征收集体所有土地房屋拆迁
  {
    pattern: /征收集体所有土地房屋拆迁条例$/,
    category: LawCategory.ECONOMIC,
    description: '房屋拆迁',
  },
  // 实施国家通用语言文字法
  {
    pattern: /实施.*国家通用语言文字法.*规定$/,
    category: LawCategory.CIVIL,
    description: '语言文字法实施',
  },
  // 预防控制非典
  {
    pattern: /预防和控制传染性非典型肺炎.*决定$/,
    category: LawCategory.CIVIL,
    description: '非典防控',
  },
  // 国民经济计划审批监督
  {
    pattern: /国民经济和社会发展计划.*审批监督.*规定$/,
    category: LawCategory.ECONOMIC,
    description: '国民经济监督',
  },
  // 达赖班禅转世灵童
  {
    pattern: /达赖.*班禅转世.*决议$/,
    category: LawCategory.PROCEDURE,
    description: '班禅转世决议',
  },
  // 民兵工作实施
  {
    pattern: /民兵工作实施办法$/,
    category: LawCategory.ADMINISTRATIVE,
    description: '民兵工作',
  },
  // 天然橡胶保护管理
  {
    pattern: /天然橡胶保护管理.*条例$/,
    category: LawCategory.ECONOMIC,
    description: '天然橡胶',
  },
  // 人大常委会监督工作
  {
    pattern: /人民代表大会常务委员会监督工作.*条例$/,
    category: LawCategory.PROCEDURE,
    description: '人大监督',
  },
  // 撤销职务程序
  {
    pattern: /撤销.*职务程序.*规定$/,
    category: LawCategory.PROCEDURE,
    description: '撤销职务',
  },
  // 人大决议
  {
    pattern: /人民代表大会.*关于.*决议$/,
    category: LawCategory.PROCEDURE,
    description: '人大决议',
  },
  // 差额选举等额选举
  {
    pattern: /关于.*实行.*选举的决定$/,
    category: LawCategory.PROCEDURE,
    description: '选举决定',
  },
  // 监护治疗管理精神病人
  {
    pattern: /监护治疗管理.*精神病人条例$/,
    category: LawCategory.CIVIL,
    description: '精神病人监护',
  },
  // 行政区召开人大
  {
    pattern: /新设置行政区召开人民代表大会.*规定$/,
    category: LawCategory.PROCEDURE,
    description: '行政区人大',
  },
  // 人大常委会视察办法
  {
    pattern: /人民代表大会常务委员会视察办法$/,
    category: LawCategory.PROCEDURE,
    description: '人大视察',
  },
  // 检查法律法规实施情况
  {
    pattern: /检查法律法规实施情况.*办法$/,
    category: LawCategory.PROCEDURE,
    description: '法规检查',
  },
  // 就业援助
  {
    pattern: /就业援助规定$/,
    category: LawCategory.LABOR,
    description: '就业援助',
  },
  // 听取人民政府专项工作报告
  {
    pattern: /听取.*人民政府.*专项工作报告.*办法$/,
    category: LawCategory.PROCEDURE,
    description: '听取报告',
  },
  // 居民委员会组织
  {
    pattern: /城市居民委员会组织条例$/,
    category: LawCategory.CIVIL,
    description: '居委会组织',
  },
  // 消费者权益保护
  {
    pattern: /消费者权益保护办法$/,
    category: LawCategory.ECONOMIC,
    description: '消费者保护',
  },
  // 达斡尔族区条例
  {
    pattern: /.*达斡尔族区.*条例$/,
    category: LawCategory.CIVIL,
    description: '民族区条例',
  },
  // 联系人大代表
  {
    pattern: /加强同.*人民代表联系.*规定$/,
    category: LawCategory.PROCEDURE,
    description: '联系代表',
  },
  // 实施邮政法
  {
    pattern: /实施.*邮政法.*办法$/,
    category: LawCategory.ECONOMIC,
    description: '邮政法实施',
  },
  // 企业名称登记管理
  {
    pattern: /企业名称登记管理规定$/,
    category: LawCategory.ECONOMIC,
    description: '企业名称',
  },
  // 滩涂管理
  {
    pattern: /滩涂管理条例$/,
    category: LawCategory.ECONOMIC,
    description: '滩涂管理',
  },
  // 人大执法检查
  {
    pattern: /人民代表大会常务委员会关于.*执法检查.*规定$/,
    category: LawCategory.PROCEDURE,
    description: '执法检查',
  },
  // 香港澳门投资
  {
    pattern: /保护和促进香港澳门投资.*条例$/,
    category: LawCategory.ECONOMIC,
    description: '港澳投资',
  },
  // 实施慈善法
  {
    pattern: /实施.*慈善法.*若干规定$/,
    category: LawCategory.CIVIL,
    description: '慈善法实施',
  },
  // 村级河湖长制
  {
    pattern: /.*村级河.*湖长制.*条例$/,
    category: LawCategory.ECONOMIC,
    description: '河湖长制',
  },
  // 实施水法
  {
    pattern: /实施.*水法.*若干规定.*$/,
    category: LawCategory.ECONOMIC,
    description: '水法实施',
  },
  // 城市照明条例
  {
    pattern: /城市照明条例$/,
    category: LawCategory.ADMINISTRATIVE,
    description: '城市照明',
  },
  // 公共客运管理
  {
    pattern: /公共客运管理条例$/,
    category: LawCategory.ECONOMIC,
    description: '公共客运',
  },
  // 台湾同胞投资
  {
    pattern: /.*鼓励.*保护.*台湾同胞投资.*条例$/,
    category: LawCategory.ECONOMIC,
    description: '台胞投资',
  },
  // 蔬菜基地管理
  {
    pattern: /蔬菜基地管理办法$/,
    category: LawCategory.ECONOMIC,
    description: '蔬菜基地',
  },
  // 检察举报
  {
    pattern: /检察举报条例$/,
    category: LawCategory.PROCEDURE,
    description: '检察举报',
  },
  // 景区条例
  {
    pattern: /.*景区条例$/,
    category: LawCategory.ECONOMIC,
    description: '景区',
  },
  // 禁止猎捕陆生野生动物
  {
    pattern: /禁止猎捕陆生野生动物条例$/,
    category: LawCategory.ECONOMIC,
    description: '野生动物保护',
  },
  // 促进技术转移
  {
    pattern: /促进技术转移条例$/,
    category: LawCategory.ECONOMIC,
    description: '技术转移',
  },
  // 住房公积金
  {
    pattern: /住房公积金条例$/,
    category: LawCategory.LABOR,
    description: '住房公积金',
  },
  // 预防小煤矿安全事故
  {
    pattern: /预防小煤矿生产安全事故规定$/,
    category: LawCategory.ADMINISTRATIVE,
    description: '煤矿安全',
  },
  // 繁殖保护区
  {
    pattern: /繁殖保护区.*管理规定$/,
    category: LawCategory.ECONOMIC,
    description: '保护区',
  },
  // 海峡西岸经济区
  {
    pattern: /海峡西岸经济区建设.*决定$/,
    category: LawCategory.ECONOMIC,
    description: '经济区建设',
  },
  // 土地权属争议处理
  {
    pattern: /土地权属争议处理.*办法$/,
    category: LawCategory.ECONOMIC,
    description: '土地争议',
  },
  // 山权林权政策
  {
    pattern: /稳定山权林权.*规定$/,
    category: LawCategory.ECONOMIC,
    description: '山权林权',
  },
  // 街道人大工作委员会
  {
    pattern: /街道人大工作委员会.*规定$/,
    category: LawCategory.PROCEDURE,
    description: '街道人大',
  },
  // 行政监察案件移送
  {
    pattern: /行政监察案件移送规定$/,
    category: LawCategory.ADMINISTRATIVE,
    description: '监察移送',
  },
  // 结核病防治
  {
    pattern: /结核病防治条例$/,
    category: LawCategory.CIVIL,
    description: '结核病防治',
  },
  // 台胞投资权益
  {
    pattern: /保障台湾同胞投资权益.*规定$/,
    category: LawCategory.ECONOMIC,
    description: '台胞权益',
  },
  // 城市道路建设管理
  {
    pattern: /城市道路.*建设与管理办法$/,
    category: LawCategory.ECONOMIC,
    description: '道路建设',
  },
  // 城市排水设施
  {
    pattern: /城市排水设施.*建设与管理办法$/,
    category: LawCategory.ECONOMIC,
    description: '排水设施',
  },
  // 统计工作管理
  {
    pattern: /统计工作管理办法$/,
    category: LawCategory.ECONOMIC,
    description: '统计管理',
  },
  // 集会游行示威
  {
    pattern: /.*集会游行示威.*规定$/,
    category: LawCategory.PROCEDURE,
    description: '集会游行示威',
  },
  // 城市道路桥梁
  {
    pattern: /城市道路桥梁管理办法$/,
    category: LawCategory.ECONOMIC,
    description: '道路桥梁',
  },
  // 涉外国家安全
  {
    pattern: /涉外建设项目国家安全事项管理条例$/,
    category: LawCategory.PROCEDURE,
    description: '涉外国家安全',
  },
  // 体育场馆管理
  {
    pattern: /体育场馆管理条例$/,
    category: LawCategory.CIVIL,
    description: '体育场馆',
  },
  // 征用收回土地
  {
    pattern: /征用.*收回土地使用权.*条例$/,
    category: LawCategory.ECONOMIC,
    description: '土地征用',
  },
  // 景区共同保护
  {
    pattern: /.*景区共同保护.*决定$/,
    category: LawCategory.ECONOMIC,
    description: '景区保护',
  },
  // 秸秆综合利用
  {
    pattern: /促进.*秸秆综合利用.*禁止.*焚烧.*决定$/,
    category: LawCategory.ECONOMIC,
    description: '秸秆综合利用',
  },
  // 上海市不动产登记
  {
    pattern: /上海市不动产登记若干规定$/,
    category: LawCategory.ECONOMIC,
    description: '上海不动产登记',
  },
  // 雅安市村级河湖长制
  {
    pattern: /雅安市.*河.*长制条例$/,
    category: LawCategory.ECONOMIC,
    description: '雅安河湖长制',
  },
];

interface FixStats {
  totalProcessed: number;
  totalFixed: number;
  byCategory: Record<string, number>;
  errors: string[];
}

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('[fix-law-categories] 法律法规分类修正迁移脚本');
  console.log('='.repeat(60));
  console.log();

  const stats: FixStats = {
    totalProcessed: 0,
    totalFixed: 0,
    byCategory: {},
    errors: [],
  };

  // 统计修正前的分布
  const beforeDistribution = await prisma.lawArticle.groupBy({
    by: ['category'],
    _count: true,
  });
  console.log('[修正前分类分布]');
  for (const item of beforeDistribution) {
    console.log(`  ${item.category}: ${item._count} 条`);
  }
  console.log();

  try {
    console.log('[fix-law-categories] 开始修正 OTHER 分类...');
    console.log();

    // 批量读取，每批 500 条
    let offset = 0;
    const batchSize = 500;
    let hasMore = true;

    while (hasMore) {
      const batch = await prisma.lawArticle.findMany({
        where: { category: LawCategory.OTHER },
        select: {
          id: true,
          lawName: true,
          category: true,
        },
        skip: offset,
        take: batchSize,
      });

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      console.log(
        `[fix-law-categories] 处理批次 ${Math.floor(offset / batchSize) + 1}，共 ${batch.length} 条...`
      );

      for (const article of batch) {
        let newCategory: LawCategory | null = null;
        let _matchedRule: (typeof KEYWORD_RULES)[0] | null = null;

        for (const rule of KEYWORD_RULES) {
          if (rule.pattern.test(article.lawName)) {
            newCategory = rule.category;
            matchedRule = rule;
            break;
          }
        }

        if (newCategory && newCategory !== article.category) {
          try {
            await prisma.lawArticle.update({
              where: { id: article.id },
              data: { category: newCategory },
            });

            stats.totalFixed++;
            stats.byCategory[newCategory] =
              (stats.byCategory[newCategory] ?? 0) + 1;

            console.log(
              `  ✓ "${article.lawName.substring(0, 40)}..." → ${newCategory}`
            );
          } catch (error) {
            const errorMsg = `更新失败 [${article.id}]: ${error}`;
            stats.errors.push(errorMsg);
            console.error(`  ✗ ${errorMsg}`);
          }
        }

        stats.totalProcessed++;
      }

      offset += batchSize;

      // 如果本批次数据少于批量大小，说明已处理完
      if (batch.length < batchSize) {
        hasMore = false;
      }

      console.log(
        `  累计：已处理 ${stats.totalProcessed} 条，已修正 ${stats.totalFixed} 条`
      );
      console.log();
    }

    console.log('='.repeat(60));
    console.log('[fix-law-categories] 修正完成！');
    console.log('='.repeat(60));
    console.log();
    console.log(`总计处理: ${stats.totalProcessed} 条`);
    console.log(`成功修正: ${stats.totalFixed} 条`);
    console.log(
      `修正率: ${((stats.totalFixed / stats.totalProcessed) * 100).toFixed(2)}%`
    );
    console.log();
    console.log('[分类分布变化]');
    for (const [category, count] of Object.entries(stats.byCategory)) {
      console.log(`  ${category}: +${count}`);
    }
    console.log();

    if (stats.errors.length > 0) {
      console.log(`[错误数量] ${stats.errors.length} 条`);
      console.log('前 5 条错误:');
      for (let i = 0; i < Math.min(5, stats.errors.length); i++) {
        console.log(`  - ${stats.errors[i]}`);
      }
    }

    // 统计修正后的分布
    const afterDistribution = await prisma.lawArticle.groupBy({
      by: ['category'],
      _count: true,
    });
    console.log();
    console.log('[修正后分类分布]');
    for (const item of afterDistribution) {
      console.log(`  ${item.category}: ${item._count} 条`);
    }
  } catch (error) {
    console.error('[fix-law-categories] 执行出错:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 执行脚本
main()
  .then(() => {
    console.log();
    console.log('[fix-law-categories] 脚本执行完毕');
    process.exit(0);
  })
  .catch(error => {
    console.error('[fix-law-categories] 脚本执行失败:', error);
    process.exit(1);
  });
