/* eslint-disable react/no-unescaped-entities */
import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '用户服务协议 | 律伴AI助手',
};

/**
 * 用户服务协议页面（Server Component）
 * 包含平台使用规范、服务说明及法律责任条款
 */
export default function TermsPage() {
  return (
    <div className='min-h-screen bg-white py-12 px-4'>
      <div className='max-w-3xl mx-auto'>
        {/* 返回首页 */}
        <div className='mb-8'>
          <Link
            href='/'
            className='text-sm text-blue-600 hover:text-blue-700 hover:underline transition-colors'
          >
            ← 返回首页
          </Link>
        </div>

        {/* 页面标题 */}
        <div className='mb-10 border-b border-zinc-200 pb-6'>
          <h1 className='text-3xl font-bold text-zinc-900 mb-2'>
            用户服务协议
          </h1>
          <p className='text-sm text-zinc-500'>最后更新日期：2025年1月1日</p>
        </div>

        {/* 协议内容 */}
        <div className='prose prose-zinc max-w-none space-y-10'>
          {/* 第一章：总则 */}
          <section>
            <h2 className='text-xl font-semibold text-zinc-800 mb-4'>
              第一章 总则
            </h2>
            <div className='space-y-3 text-zinc-600 leading-relaxed'>
              <p>
                律伴AI助手（以下简称"本平台"或"我们"）是由律伴科技有限公司运营的人工智能法律辅助服务平台。本平台致力于运用自然语言处理与大语言模型技术，为法律从业者提供法条检索、合同审查、法律辩论生成、案件分析等专业工具。
              </p>
              <p>
                本《用户服务协议》（以下简称"本协议"）适用于所有访问、注册或使用本平台服务的自然人、法人及其他组织（以下统称"用户"）。用户在点击"同意"或实际使用本平台任何服务时，即视为已充分阅读、理解并同意本协议全部条款。如您不同意本协议任何条款，请立即停止使用本平台。
              </p>
              <p>
                本协议与《隐私政策》共同构成您使用本平台服务的完整法律文件。我们保留随时修订本协议的权利，修订后的协议将在平台公告发布后生效。如您在协议更新后继续使用本平台，视为接受修订后的协议。
              </p>
            </div>
          </section>

          {/* 第二章：账号注册与管理 */}
          <section>
            <h2 className='text-xl font-semibold text-zinc-800 mb-4'>
              第二章 账号注册与管理
            </h2>
            <div className='space-y-3 text-zinc-600 leading-relaxed'>
              <p>
                注册本平台账号须满足以下条件：（1）年满18周岁且具有完全民事行为能力的自然人，或依法成立并合法运营的法人及其他组织；（2）具有真实的使用需求，不以任何形式的恶意测试、爬取数据或商业竞争为目的；（3）提供真实、准确、完整的注册信息，包括有效电子邮箱及真实姓名。
              </p>
              <p>
                本平台对律师用户实施执业资格认证机制。认证律师需上传有效的律师执业证书原件照片，经平台人工审核通过后方可获得认证标识，并解锁对应的高级功能权限。认证信息如有变更，用户有义务及时更新。提交虚假认证材料将导致账号封禁，情节严重者本平台将依法追究法律责任。
              </p>
              <p>
                账号安全由用户自行负责。请妥善保管您的登录凭证，不得将账号转让、出售或授权他人使用。如发现账号被盗用或遭受未经授权的访问，请立即通过官方渠道联系我们。因用户自身原因导致账号信息泄露所产生的一切损失，由用户自行承担。
              </p>
            </div>
          </section>

          {/* 第三章：服务内容 */}
          <section>
            <h2 className='text-xl font-semibold text-zinc-800 mb-4'>
              第三章 服务内容
            </h2>
            <div className='space-y-3 text-zinc-600 leading-relaxed'>
              <p>
                本平台目前提供以下核心服务：（1）<strong>法条智能检索</strong>
                ——基于语义理解的法律法规全文检索，支持关键词、法律领域及条文内容的多维度查询；（2）
                <strong>AI辅助法律辩论</strong>
                ——自动生成正方/反方论点框架，结合相关法条与司法解释，辅助律师进行庭前准备；（3）
                <strong>合同智能审查</strong>
                ——对上传合同文件进行条款风险识别与标注，提示潜在法律风险点；（4）
                <strong>案件分析与管理</strong>
                ——案件信息归档、证据材料管理及案件进度跟踪。
              </p>
              <p>
                <strong>重要免责声明：</strong>
                本平台所有AI生成的分析结果、法律意见、辩论论点及合同审查报告，均
                <strong>
                  仅供用户参考，不构成正式法律意见，不具有法律效力
                </strong>
                。人工智能技术存在固有局限，其输出内容可能存在错误、遗漏或不适用于具体案件情况。用户在做出任何具体法律决策之前，必须寻求具有执业资格的律师提供专业法律咨询。本平台不对用户基于AI分析结果所作决策产生的后果承担任何法律责任。
              </p>
              <p>
                本平台依据用户的会员等级提供差异化服务。免费用户享有基础检索和有限次数的AI功能；付费会员可解锁更高的使用配额、高级分析功能及优先客户支持。会员服务的具体内容和定价以平台实时公示为准，我们保留调整服务套餐的权利，并提前以站内通知方式告知用户。
              </p>
            </div>
          </section>

          {/* 第四章：用户行为规范 */}
          <section>
            <h2 className='text-xl font-semibold text-zinc-800 mb-4'>
              第四章 用户行为规范
            </h2>
            <div className='space-y-3 text-zinc-600 leading-relaxed'>
              <p>
                用户在使用本平台过程中，须遵守中华人民共和国相关法律法规，不得从事任何违法或有害行为，包括但不限于：上传或传播包含违法内容的文件；利用本平台服务为刑事犯罪、诈骗、洗钱等非法活动提供辅助；侵犯他人知识产权、隐私权或其他合法权益；散布虚假法律信息误导公众；以及任何形式的骚扰、恐吓或威胁行为。
              </p>
              <p>
                用户不得以任何技术手段滥用本平台AI功能，包括但不限于：通过自动化脚本批量调用API接口；尝试逆向工程、破解或绕过本平台的安全机制；对本平台实施拒绝服务攻击（DDoS）或其他网络攻击行为；以竞争分析或商业情报采集为目的大规模抓取平台数据。
              </p>
              <p>
                对于违反上述规范的用户，本平台有权采取警告、限制功能、暂停服务或永久封禁账号等措施，情节严重的将依法追究法律责任并向相关主管机关报告。
              </p>
            </div>
          </section>

          {/* 第五章：知识产权 */}
          <section>
            <h2 className='text-xl font-semibold text-zinc-800 mb-4'>
              第五章 知识产权
            </h2>
            <div className='space-y-3 text-zinc-600 leading-relaxed'>
              <p>
                本平台及其所有功能组件、技术架构、UI设计、算法模型、品牌标识等，其知识产权均归律伴科技有限公司所有，受中华人民共和国《著作权法》《专利法》《商标法》等法律法规保护。未经书面授权，用户不得复制、修改、传播或以任何商业目的使用本平台的知识产权内容。
              </p>
              <p>
                用户上传至本平台的文件、案件描述、合同文本等内容（以下简称"用户内容"），其知识产权归用户本人所有。用户通过上传行为，授予本平台一项非独占性、免版税、全球范围内的许可，用于提供、改进和展示相关服务。本平台不会在未经授权的情况下将用户内容用于任何第三方商业目的。
              </p>
            </div>
          </section>

          {/* 第六章：免责声明 */}
          <section>
            <h2 className='text-xl font-semibold text-zinc-800 mb-4'>
              第六章 免责声明
            </h2>
            <div className='space-y-3 text-zinc-600 leading-relaxed'>
              <p>
                本平台AI分析功能基于大语言模型技术，该技术在当前发展阶段存在客观局限性：模型可能产生"幻觉"（即生成看似合理但实际错误的内容），可能未能覆盖最新颁布的法律法规，也可能对特定司法管辖区或专业领域的法律理解存在偏差。用户须以批判性思维审查AI生成的所有内容，不应将其视为权威法律意见。
              </p>
              <p>
                本平台按"现状"提供服务，不就服务的不间断性、无错误性、及时性或适合特定用途作出任何明示或暗示的保证。本平台将尽力维护系统稳定性，但对因不可抗力、第三方服务故障、网络中断或例行维护导致的服务中断，不承担赔偿责任。在法律允许的最大范围内，本平台对用户因使用或无法使用本服务所遭受的任何直接或间接损失，不承担超出用户实际支付服务费用金额的赔偿责任。
              </p>
            </div>
          </section>

          {/* 第七章：服务变更与终止 */}
          <section>
            <h2 className='text-xl font-semibold text-zinc-800 mb-4'>
              第七章 服务变更与终止
            </h2>
            <div className='space-y-3 text-zinc-600 leading-relaxed'>
              <p>
                本平台保留根据业务发展需要调整、更新或终止部分或全部服务功能的权利。重大功能变更或服务终止，将提前不少于30天以站内通知或电子邮件方式告知受影响用户，并在条件允许时提供数据导出功能，保障用户对其数据的自主权。
              </p>
              <p>
                发生以下情形之一时，本平台有权立即暂停或终止用户账号，无需提前通知：（1）用户违反本协议任何条款；（2）用户从事违法犯罪活动；（3）用户的使用行为对其他用户或平台造成实质性损害；（4）司法机关、行政机关依法要求；（5）用户账号长期（超过12个月）未有任何活动记录。账号终止后，与该账号相关联的数据将按照《隐私政策》规定的保留期限处理。
              </p>
            </div>
          </section>

          {/* 第八章：争议解决 */}
          <section>
            <h2 className='text-xl font-semibold text-zinc-800 mb-4'>
              第八章 争议解决
            </h2>
            <div className='space-y-3 text-zinc-600 leading-relaxed'>
              <p>
                本协议的订立、效力、履行、解释及争议解决，均适用中华人民共和国大陆地区法律。如出现本协议与适用法律相抵触之条款，该条款将在最小必要范围内重新解释以符合法律要求，协议其余部分继续有效。
              </p>
              <p>
                用户与本平台之间因本协议或使用本平台服务而产生的任何争议，双方应首先通过友好协商解决。协商不成的，任何一方均有权向本平台经营主体所在地（即公司注册地）具有管辖权的人民法院提起诉讼。
              </p>
            </div>
          </section>

          {/* 第九章：联系方式 */}
          <section>
            <h2 className='text-xl font-semibold text-zinc-800 mb-4'>
              第九章 联系方式
            </h2>
            <div className='space-y-3 text-zinc-600 leading-relaxed'>
              <p>
                如您对本服务协议有任何疑问、意见或投诉，欢迎通过以下方式与我们联系：
              </p>
              <p>
                电子邮件：
                <a
                  href='mailto:support@luban-ai.com'
                  className='text-blue-600 hover:text-blue-700 hover:underline ml-1'
                >
                  support@luban-ai.com
                </a>
              </p>
              <p>
                我们将在收到您的邮件后5个工作日内给予回复。如涉及账号安全紧急情况，请在邮件标题中注明"紧急"字样，我们将优先处理。
              </p>
            </div>
          </section>
        </div>

        {/* 底部返回链接 */}
        <div className='mt-12 pt-6 border-t border-zinc-200 flex gap-6 text-sm text-zinc-500'>
          <Link href='/' className='hover:text-blue-600 transition-colors'>
            返回首页
          </Link>
          <Link
            href='/privacy'
            className='hover:text-blue-600 transition-colors'
          >
            查看隐私政策
          </Link>
        </div>
      </div>
    </div>
  );
}
