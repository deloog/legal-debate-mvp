/* eslint-disable react/no-unescaped-entities */
import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '隐私政策 | 律伴AI助手',
};

/**
 * 隐私政策页面（Server Component）
 * 说明本平台收集、使用及保护用户个人信息的方式
 */
export default function PrivacyPage() {
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
          <h1 className='text-3xl font-bold text-zinc-900 mb-2'>隐私政策</h1>
          <p className='text-sm text-zinc-500'>最后更新日期：2025年1月1日</p>
        </div>

        {/* 隐私政策内容 */}
        <div className='prose prose-zinc max-w-none space-y-10'>
          {/* 引言 */}
          <p className='text-zinc-600 leading-relaxed bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm'>
            律伴AI助手（律伴科技有限公司，以下简称"我们"）非常重视您的个人信息与隐私保护。本隐私政策依据《中华人民共和国个人信息保护法》《网络安全法》《数据安全法》等法律法规制定，详细说明我们如何收集、使用、存储和保护您的个人信息。
          </p>

          {/* 第一章：信息收集 */}
          <section>
            <h2 className='text-xl font-semibold text-zinc-800 mb-4'>
              一、信息收集
            </h2>
            <div className='space-y-3 text-zinc-600 leading-relaxed'>
              <p>
                <strong>注册信息：</strong>
                在您创建账号时，我们收集您提供的电子邮箱地址、登录密码（加密存储，明文不可见）、真实姓名或昵称。对于申请认证的律师用户，还需收集律师执业证编号和证件照片，用于资质核验。
              </p>
              <p>
                <strong>使用数据：</strong>
                在您使用平台服务过程中，我们自动记录服务使用行为，包括：您检索的法条关键词（用于改善搜索相关性）、创建的案件和辩论记录（为您提供历史查询）、上传的合同文件内容（仅用于本次分析，不用于其他目的）、AI功能的调用记录（用于配额统计和服务优化）。
              </p>
              <p>
                <strong>设备信息：</strong>
                我们收集您访问本平台时的基础技术信息，包括IP地址（用于安全防护）、浏览器类型和版本、操作系统信息、以及通过Cookie记录的会话标识。我们不收集设备的IMEI、位置等敏感标识符。
              </p>
            </div>
          </section>

          {/* 第二章：信息使用 */}
          <section>
            <h2 className='text-xl font-semibold text-zinc-800 mb-4'>
              二、信息使用
            </h2>
            <div className='space-y-3 text-zinc-600 leading-relaxed'>
              <p>
                <strong>提供服务：</strong>
                我们使用您的信息来创建和维护您的账号、提供您请求的AI分析功能、处理订单和支付、发送服务通知（如审核结果、到期提醒）。没有这些信息，我们将无法向您提供核心服务。
              </p>
              <p>
                <strong>改善产品：</strong>
                我们对汇聚的使用数据进行统计分析（经过脱敏和匿名化处理），以了解功能使用模式、识别常见问题并优化AI模型性能。我们不会将您的个人身份与产品改进分析直接挂钩。
              </p>
              <p>
                <strong>安全保障：</strong>
                我们使用IP地址、登录行为等信息检测和防范账号盗用、异常访问、恶意攻击等安全威胁，保障所有用户的账号安全和平台稳定运行。
              </p>
            </div>
          </section>

          {/* 第三章：信息共享 */}
          <section>
            <h2 className='text-xl font-semibold text-zinc-800 mb-4'>
              三、信息共享
            </h2>
            <div className='space-y-3 text-zinc-600 leading-relaxed'>
              <p>
                我们
                <strong>不会向任何第三方出售、出租或交易您的个人信息</strong>
                。这是我们对用户隐私保护的核心承诺。您的数据不会被用于定向广告投放，也不会被提供给商业合作伙伴用于其自身的营销目的。
              </p>
              <p>
                仅在以下有限情形下，我们可能共享您的信息：（1）
                <strong>法律要求</strong>
                ——在收到合法的司法机关或行政机关的书面要求时，我们依法配合，并在法律允许范围内通知您；（2）
                <strong>服务提供商</strong>
                ——我们委托受信任的技术服务商（如云服务器提供商、支付处理商）处理数据时，通过合同约束其只能按我们的指示处理数据，不得将数据用于其他目的；（3）
                <strong>用户明确授权</strong>
                ——在您主动申请将账号信息共享至第三方平台（如律所管理系统集成）时，经您明确确认后执行。
              </p>
            </div>
          </section>

          {/* 第四章：数据安全 */}
          <section>
            <h2 className='text-xl font-semibold text-zinc-800 mb-4'>
              四、数据安全
            </h2>
            <div className='space-y-3 text-zinc-600 leading-relaxed'>
              <p>
                <strong>加密存储：</strong>用户密码使用 bcrypt
                算法加密存储，永不以明文形式保存。敏感数据在传输过程中强制使用
                TLS 1.2
                及以上版本加密。数据库服务器与应用服务器物理隔离，数据库不直接对外网暴露。
              </p>
              <p>
                <strong>访问控制：</strong>
                平台内部实施严格的权限管理，员工只能访问其工作职责所必需的数据范围。所有内部数据访问行为均有日志记录，并定期进行权限审查。我们对开发、测试和生产环境的数据进行严格隔离，测试环境使用脱敏数据。
              </p>
              <p>
                <strong>安全审计：</strong>
                我们定期对系统进行安全漏洞扫描和渗透测试，并建立了安全事件响应机制。如发生数据泄露事件，我们将在发现后72小时内按照法律要求向相关监管机构报告，并及时通知可能受影响的用户。
              </p>
            </div>
          </section>

          {/* 第五章：用户权利 */}
          <section>
            <h2 className='text-xl font-semibold text-zinc-800 mb-4'>
              五、用户权利
            </h2>
            <div className='space-y-3 text-zinc-600 leading-relaxed'>
              <p>
                根据《个人信息保护法》，您对自己的个人信息享有以下权利：（1）
                <strong>查阅权</strong>
                ——您可以随时登录账号查看您的个人信息，或通过邮件申请获取我们持有的关于您的完整数据报告；（2）
                <strong>更正权</strong>
                ——如您发现我们持有的信息不准确或不完整，可以在账号设置页面自行修改，或联系我们代为更正；（3）
                <strong>删除权</strong>
                ——您可以申请删除您的账号及相关个人信息，我们将在30个工作日内处理，但出于法律合规要求需保留的数据（如交易记录）除外；（4）
                <strong>数据可携权</strong>
                ——您可以申请导出您在平台上创建的案件、合同等数据，以便迁移至其他平台。
              </p>
              <p>
                如需行使上述权利，请发送邮件至
                privacy@luban-ai.com，注明您的用户邮箱和具体申请内容。为保障账号安全，我们在处理上述申请前可能需要核验您的身份。
              </p>
            </div>
          </section>

          {/* 第六章：Cookie 使用 */}
          <section>
            <h2 className='text-xl font-semibold text-zinc-800 mb-4'>
              六、Cookie 使用
            </h2>
            <div className='space-y-3 text-zinc-600 leading-relaxed'>
              <p>
                本平台仅使用功能性
                Cookie，即维持您登录状态所必需的会话令牌（Session Token）。这类
                Cookie 在您关闭浏览器或退出登录后自动失效。我们
                <strong>不使用</strong>跟踪 Cookie、广告 Cookie 或第三方分析
                Cookie。
              </p>
              <p>
                您可以在浏览器设置中禁用所有
                Cookie，但这将导致您无法保持登录状态，影响正常使用。由于我们仅使用必要功能性
                Cookie，禁用 Cookie
                不会阻止您以访客身份浏览公开内容，但会要求您在每次访问时重新登录。
              </p>
            </div>
          </section>

          {/* 第七章：未成年人保护 */}
          <section>
            <h2 className='text-xl font-semibold text-zinc-800 mb-4'>
              七、未成年人保护
            </h2>
            <div className='space-y-3 text-zinc-600 leading-relaxed'>
              <p>
                本平台的服务对象为18周岁及以上具有完全民事行为能力的成年人。我们不面向未成年人提供服务，也不故意收集未成年人的个人信息。注册账号时，您确认自己已年满18周岁。
              </p>
              <p>
                如果我们发现或接到举报称某个账号由未成年人注册使用，我们将立即暂停该账号并删除相关个人信息。如您发现此类情况，请通过
                privacy@luban-ai.com 告知我们。
              </p>
            </div>
          </section>

          {/* 第八章：隐私政策更新 */}
          <section>
            <h2 className='text-xl font-semibold text-zinc-800 mb-4'>
              八、隐私政策更新
            </h2>
            <div className='space-y-3 text-zinc-600 leading-relaxed'>
              <p>
                随着平台功能迭代和法律法规的更新，我们可能会修订本隐私政策。对于实质性变更（如新增收集信息类型、改变信息使用目的），我们将通过以下方式提前告知：（1）在平台首页或账号登录界面展示醒目提示；（2）向您的注册邮箱发送更新通知；（3）在更新生效前提供不少于7天的阅读期。
              </p>
              <p>
                轻微的非实质性修改（如错别字更正、措辞优化）不会单独通知，但更新日期将同步更新。所有历史版本的隐私政策将在平台上存档，您可以随时查阅。如您在政策更新后继续使用本平台，视为接受更新后的隐私政策。
              </p>
            </div>
          </section>

          {/* 第九章：联系我们 */}
          <section>
            <h2 className='text-xl font-semibold text-zinc-800 mb-4'>
              九、联系我们
            </h2>
            <div className='space-y-3 text-zinc-600 leading-relaxed'>
              <p>
                如您对本隐私政策有任何疑问、意见，或希望行使您的个人信息权利，请联系我们的隐私保护团队：
              </p>
              <p>
                电子邮件：
                <a
                  href='mailto:privacy@luban-ai.com'
                  className='text-blue-600 hover:text-blue-700 hover:underline ml-1'
                >
                  privacy@luban-ai.com
                </a>
              </p>
              <p>
                我们设有专职的个人信息保护负责人，负责处理所有隐私相关事务。对于您的隐私权利申请，我们承诺在15个工作日内给予书面答复。如您对我们的答复不满意，您有权向所在地的网信部门或其他有权监管机构进行投诉。
              </p>
            </div>
          </section>
        </div>

        {/* 底部返回链接 */}
        <div className='mt-12 pt-6 border-t border-zinc-200 flex gap-6 text-sm text-zinc-500'>
          <Link href='/' className='hover:text-blue-600 transition-colors'>
            返回首页
          </Link>
          <Link href='/terms' className='hover:text-blue-600 transition-colors'>
            查看用户服务协议
          </Link>
        </div>
      </div>
    </div>
  );
}
