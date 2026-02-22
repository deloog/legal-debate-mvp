'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FileText,
  RefreshCw,
  ArrowRight,
  Sparkles,
  FileStack,
} from 'lucide-react';

/**
 * 案件类型代码映射（用于案号生成）
 */
const caseTypeCodes: Record<string, { code: string; name: string }> = {
  CIVIL: { code: 'M', name: '民' },
  CRIMINAL: { code: 'X', name: '刑' },
  ADMINISTRATIVE: { code: 'G', name: '行' },
  COMMERCIAL: { code: 'S', name: '商' },
  LABOR: { code: 'L', name: '劳' },
  INTELLECTUAL_PROPERTY: { code: 'Z', name: '知' },
};

/**
 * 案件状态代码映射
 */
const statusCodes: Record<string, string> = {
  DRAFT: '初',
  ACTIVE: '初',
  COMPLETED: '终',
  ARCHIVED: '决',
};

/**
 * 案件描述模板（按案件类型分类）
 */
const caseDescriptionTemplates: Record<
  string,
  { title: string; template: string }[]
> = {
  CIVIL: [
    {
      title: '合同纠纷',
      template:
        '原告{plaintiff}与被告{defendant}因{cause}合同发生纠纷。原告认为被告未按合同约定履行义务，造成原告损失。现依据《中华人民共和国民法典》相关规定，向贵院提起诉讼，请求判令被告{plaintiff}。',
    },
    {
      title: '债务纠纷',
      template:
        '被告{defendant}向原告{plaintiff}借款人民币{amount}元，双方约定还款日期为{date}。到期后，被告未按时还款，经原告多次催讨，被告仍拒不偿还。为维护原告合法权益，特向贵院提起诉讼。',
    },
    {
      title: '房产纠纷',
      template:
        '原告{plaintiff}与被告{defendant}就位于{location}的房产发生权属争议。原告依据相关证据认为该房产应归其所有，但被告坚持认为该房产归其所有。双方多次协商未果，现向贵院提起诉讼。',
    },
    {
      title: '婚姻家庭',
      template:
        '原告{plaintiff}与被告{defendant}系夫妻关系，因{cause}导致感情破裂。双方就子女抚养、财产分割等问题无法达成一致。现原告依据《中华人民共和国民法典》相关规定，向贵院提起离婚诉讼。',
    },
    {
      title: '侵权责任',
      template:
        '被告{defendant}的行为造成原告{plaintiff}人身损害/财产损失。经{location}事故认定，被告负主要/全部责任。原告要求被告赔偿医疗费、误工费、护理费等各项损失共计{amount}元。',
    },
    {
      title: '邻里纠纷',
      template:
        '原告{plaintiff}与被告{defendant}系邻里关系，因{cause}发生纠纷。原告认为被告的行为严重影响了原告的正常生活，双方经居委会/物业调解未果，现向贵院提起诉讼。',
    },
    {
      title: '继承纠纷',
      template:
        '被继承人{location}于{date}去世，留有遗产{amount}元及房产一处。原告{plaintiff}作为法定继承人/遗嘱受益人，要求依法继承相应份额。被告{defendant}对遗产分配提出异议，双方协商未果。',
    },
    {
      title: '借贷纠纷',
      template:
        '原告{plaintiff}与被告{defendant}于{date}签订借款合同，约定被告向原告借款{amount}元，期限为{location}。合同签订后，原告按约支付了借款，但被告未按期还款。',
    },
    {
      title: '物业纠纷',
      template:
        '原告{plaintiff}系{location}小区业主，被告{defendant}作为物业管理公司，未按合同约定提供物业服务，导致小区环境脏乱差、安保缺失。原告要求被告履行合同义务并赔偿损失。',
    },
    {
      title: '交通事故',
      template:
        '{date}，被告{defendant}驾驶机动车与原告{plaintiff}发生交通事故，造成原告人身损害。经交警部门认定，被告负事故{result}责任。原告要求被告赔偿医疗费等各项费用。',
    },
  ],
  CRIMINAL: [
    {
      title: '故意伤害',
      template:
        '犯罪嫌疑人{defendant}因{cause}与被害人{plaintiff}发生冲突，后持凶器对被害人实施伤害，造成被害人{result}。犯罪嫌疑人行为已触犯《中华人民共和国刑法》第二百三十四条之规定，涉嫌故意伤害罪。',
    },
    {
      title: '盗窃',
      template:
        '犯罪嫌疑人{defendant}于{date}，在{location}秘密窃取被害人{plaintiff}财物，涉案金额约{amount}元。犯罪嫌疑人行为已触犯《中华人民共和国刑法》第二百六十四条之规定，涉嫌盗窃罪。',
    },
    {
      title: '诈骗',
      template:
        '犯罪嫌疑人{defendant}以非法占有为目的，通过{means}方式骗取被害人{plaintiff}人民币{amount}元。犯罪嫌疑人行为已触犯《中华人民共和国刑法》第二百六十六条之规定，涉嫌诈骗罪。',
    },
    {
      title: '危险驾驶',
      template:
        '犯罪嫌疑人{defendant}于{date}在{location}醉酒驾驶/追逐竞驶，造成{result}。犯罪嫌疑人行为已触犯《中华人民共和国刑法》第一百三十三条之一之规定，涉嫌危险驾驶罪。',
    },
    {
      title: '寻衅滋事',
      template:
        '犯罪嫌疑人{defendant}于{date}在{location}随意殴打被害人{plaintiff}，造成{result}。犯罪嫌疑人行为已触犯《中华人民共和国刑法》第二百九十三条之规定，涉嫌寻衅滋事罪。',
    },
    {
      title: '非法拘禁',
      template:
        '犯罪嫌疑人{defendant}为索取债务/发泄不满，于{date}将被害人{plaintiff}非法拘禁在{location}，限制其人身自由{result}。犯罪嫌疑人行为已触犯《中华人民共和国刑法》第二百三十八条之规定。',
    },
    {
      title: '交通肇事',
      template:
        '犯罪嫌疑人{defendant}于{date}驾驶机动车在{location}发生交通事故，造成{result}。经交警部门认定，犯罪嫌疑人负事故主要/全部责任。犯罪嫌疑人行为已触犯《中华人民共和国刑法》第一百三十三条之规定。',
    },
  ],
  LABOR: [
    {
      title: '劳动争议',
      template:
        '申请人{plaintiff}与被申请人{defendant}因{cause}发生劳动争议。申请人认为被申请人违法解除劳动合同，要求支付违法解除赔偿金{amount}元及其他相关待遇。经劳动仲裁前置后，现向贵院提起诉讼。',
    },
    {
      title: '工伤赔偿',
      template:
        '申请人{plaintiff}系被申请人{defendant}职工，在工作中因{cause}受伤，经认定为工伤。申请人要求被申请人支付一次性伤残补助金、一次性工伤医疗补助金等共计{amount}元。',
    },
    {
      title: '拖欠工资',
      template:
        '申请人{plaintiff}在被申请人{defendant}处工作期间，被申请人拖欠申请人工资{amount}元，经申请人多次催讨，被申请人仍拒不支付。申请人要求被申请人支付拖欠工资及经济补偿金。',
    },
    {
      title: '社保争议',
      template:
        '申请人{plaintiff}在被申请人{defendant}工作期间，被申请人未依法为申请人缴纳社会保险。申请人要求被申请人补缴社会保险费或赔偿相应损失。',
    },
    {
      title: '经济补偿金',
      template:
        '申请人{plaintiff}与被申请人{defendant}协商解除劳动合同/合同期满，被申请人未依法支付经济补偿金{amount}元。申请人要求被申请人支付经济补偿金。',
    },
    {
      title: '加班费',
      template:
        '申请人在被申请人{defendant}处工作期间，存在大量加班事实，但被申请人未支付加班费。申请人要求被申请人支付加班费共计{amount}元。',
    },
  ],
  COMMERCIAL: [
    {
      title: '商业合同违约',
      template:
        '原告{plaintiff}与被告{defendant}签订《{contract_type}合同》，约定{content}。合同签订后，原告已履行合同义务，但被告未按约定{action}，构成违约。原告因此遭受损失{amount}元。',
    },
    {
      title: '股权纠纷',
      template:
        '原告{plaintiff}与被告{defendant}因{cause}股权问题发生争议。原告认为被告侵害了其股东权益，要求被告{claim}。双方协商未果，现向贵院提起诉讼。',
    },
    {
      title: '公司决议效力',
      template:
        '原告{plaintiff}作为公司股东，认为被告{defendant}主持召开的股东会所做出的决议违反公司章程/法律规定，请求法院确认该决议无效/予以撤销。',
    },
    {
      title: '合伙纠纷',
      template:
        '原告{plaintiff}与被告{defendant}签订《合伙协议》，约定共同经营{location}。现因{cause}产生分歧，双方无法达成一致意见，原告要求解除合伙关系并进行清算。',
    },
    {
      title: '保险合同纠纷',
      template:
        '原告{plaintiff}在被告{defendant}处投保{contract_type}保险，保险期间发生保险事故。被告以{cause}为由拒绝/少陪保险金。原告要求被告依约赔付保险金{amount}元。',
    },
    {
      title: '票据纠纷',
      template:
        '原告{plaintiff}合法持有票据，被告{defendant}作为付款人/承兑人拒绝支付票款{amount}元。原告要求被告支付票款及利息。',
    },
    {
      title: '金融借款',
      template:
        '被告{defendant}向原告{plaintiff}借款{amount}元，用于{location}。被告未按期还本付息，原告要求被告偿还本金、利息及违约金。',
    },
  ],
  ADMINISTRATIVE: [
    {
      title: '行政处罚异议',
      template:
        '原告{plaintiff}对{department}作出的{penalty_type}决定不服，认为该处罚决定认定事实不清、适用法律错误。原告要求撤销该行政处罚决定，或减轻处罚。',
    },
    {
      title: '行政强制',
      template:
        '原告{plaintiff}对{department}采取的{action}行政强制措施不服，认为该措施违反法定程序，侵害了原告合法权益。现依法提起行政诉讼。',
    },
    {
      title: '信息公开',
      template:
        '原告{plaintiff}向{department}申请公开{location}相关信息，{department}未在法定期限内予以答复/拒绝公开。原告要求{department}依法公开相关信息。',
    },
    {
      title: '行政许可',
      template:
        '原告{plaintiff}向{department}申请{location}行政许可，{department}不予许可/不予答复。原告认为{department}的决定违反法律规定，要求其履行许可职责。',
    },
    {
      title: '行政赔偿',
      template:
        '原告{plaintiff}的合法财产被{department}违法采取行政强制措施造成损失，要求{department}行政赔偿{amount}元。',
    },
  ],
  INTELLECTUAL_PROPERTY: [
    {
      title: '著作权侵权',
      template:
        '原告{plaintiff}依法享有"{work}"作品的著作权。被告{defendant}未经原告许可，擅自{action}该作品，侵犯了原告的著作权。原告要求被告停止侵权并赔偿损失{amount}元。',
    },
    {
      title: '专利侵权',
      template:
        '原告{plaintiff}依法享有专利号{patent}的专利权。被告{defendant}生产、销售的产品{product}落入原告专利保护范围，构成专利侵权。原告要求被告停止侵权并赔偿损失。',
    },
  ],
};

/**
 * 通用模板
 */
const commonTemplates = [
  {
    title: '通用模板',
    template:
      '本案系{type}案件。原告{plaintiff}与被告{defendant}因{cause}发生争议，请求法院依法判决。',
  },
];

/**
 * 创建案件页面
 * 功能：提供表单供用户创建新案件
 */
export default function CreateCasePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const consultationId = searchParams.get('consultationId');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consultationData, setConsultationData] = useState<{
    id: string;
    caseSummary: string;
    clientName: string;
    clientPhone: string;
  } | null>(null);
  const [isLoadingConsultation, setIsLoadingConsultation] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'CIVIL',
    status: 'DRAFT',
    caseNumber: '',
    cause: '',
    court: '',
    plaintiffName: '',
    defendantName: '',
    amount: '',
  });

  // 如果有 consultationId，获取咨询数据
  useEffect(() => {
    async function fetchConsultation() {
      if (!consultationId) return;

      setIsLoadingConsultation(true);
      try {
        const response = await fetch(`/api/v1/consultations/${consultationId}`);
        if (response.ok) {
          const data = await response.json();
          const consultation = data.data;

          // 预填充表单
          setFormData(prev => ({
            ...prev,
            description: consultation.caseSummary || '',
            plaintiffName: consultation.clientName || '',
          }));

          setConsultationData({
            id: consultation.id,
            caseSummary: consultation.caseSummary || '',
            clientName: consultation.clientName || '',
            clientPhone: consultation.clientPhone || '',
          });
        }
      } catch (error) {
        console.error('获取咨询信息失败:', error);
      } finally {
        setIsLoadingConsultation(false);
      }
    }

    fetchConsultation();
  }, [consultationId]);

  // 自动生成案号（调用后端 API 获取连续案号）
  const generateCaseNumber = async () => {
    try {
      const response = await fetch(
        `/api/v1/cases/generate-case-number?type=${formData.type}`
      );
      const data = await response.json();

      if (data.success && data.data.caseNumber) {
        setFormData(prev => ({ ...prev, caseNumber: data.data.caseNumber }));
      } else {
        // 后端生成失败时，使用本地生成（降级方案）
        const year = new Date().getFullYear();
        const typeInfo = caseTypeCodes[formData.type] || {
          code: 'M',
          name: '民',
        };
        const statusCode = statusCodes[formData.status] || '初';
        const randomNum = Math.floor(Math.random() * 9000 + 1000);
        const newCaseNumber = `${year}${typeInfo.code}${typeInfo.name}${statusCode}${randomNum}号`;
        setFormData(prev => ({ ...prev, caseNumber: newCaseNumber }));
      }
    } catch (error) {
      console.error('生成案号失败:', error);
      // 降级方案
      const year = new Date().getFullYear();
      const typeInfo = caseTypeCodes[formData.type] || {
        code: 'M',
        name: '民',
      };
      const statusCode = statusCodes[formData.status] || '初';
      const randomNum = Math.floor(Math.random() * 9000 + 1000);
      const newCaseNumber = `${year}${typeInfo.code}${typeInfo.name}${statusCode}${randomNum}号`;
      setFormData(prev => ({ ...prev, caseNumber: newCaseNumber }));
    }
  };

  // 应用模板
  const applyTemplate = (template: string) => {
    const filledTemplate = template
      .replace(/{plaintiff}/g, formData.plaintiffName || '原告')
      .replace(/{defendant}/g, formData.defendantName || '被告')
      .replace(/{cause}/g, formData.cause || '相关')
      .replace(/{amount}/g, formData.amount || '待定')
      .replace(/{date}/g, new Date().toLocaleDateString('zh-CN'))
      .replace(/{location}/g, '待定')
      .replace(/{result}/g, '待定')
      .replace(/{means}/g, '虚构事实')
      .replace(/{contract_type}/g, '买卖')
      .replace(/{content}/g, '待定')
      .replace(/{action}/g, '履行')
      .replace(/{claim}/g, '停止侵害')
      .replace(/{department}/g, '相关行政机关')
      .replace(/{penalty_type}/g, '行政处罚')
      .replace(/{work}/g, '待定作品')
      .replace(/{patent}/g, '待定专利')
      .replace(/{product}/g, '待定产品')
      .replace(
        /{type}/g,
        formData.type === 'CIVIL'
          ? '民事'
          : formData.type === 'CRIMINAL'
            ? '刑事'
            : formData.type === 'LABOR'
              ? '劳动'
              : formData.type === 'COMMERCIAL'
                ? '商事'
                : formData.type === 'ADMINISTRATIVE'
                  ? '行政'
                  : '知识产权'
      );

    setFormData(prev => ({ ...prev, description: filledTemplate }));
    setShowTemplates(false);
  };

  // AI 生成案情描述
  const generateWithAI = async () => {
    // 不强制要求填写内容，AI 会根据案件类型生成通用模板
    setIsGeneratingAI(true);
    setErrors(prev => ({ ...prev, description: '' }));

    try {
      const response = await fetch('/api/ai/generate-case-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plaintiffName: formData.plaintiffName,
          defendantName: formData.defendantName,
          cause: formData.cause,
          caseType: formData.type,
          amount: formData.amount,
        }),
      });

      const data = await response.json();

      if (data.success && data.data.description) {
        setFormData(prev => ({ ...prev, description: data.data.description }));
      } else {
        // AI 生成失败，使用模板
        const templates =
          caseDescriptionTemplates[formData.type] || commonTemplates;
        const fallbackTemplate =
          templates[0]?.template || commonTemplates[0].template;
        applyTemplate(fallbackTemplate);
      }
    } catch (error) {
      console.error('AI生成失败:', error);
      // 降级使用模板
      const templates =
        caseDescriptionTemplates[formData.type] || commonTemplates;
      const fallbackTemplate =
        templates[0]?.template || commonTemplates[0].template;
      applyTemplate(fallbackTemplate);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = '请输入案件标题';
    }

    if (!formData.type) {
      newErrors.type = '请选择案件类型';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/v1/cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          amount: formData.amount ? parseFloat(formData.amount) : null,
          metadata: consultationId ? { consultationId } : {},
        }),
      });

      const data = await response.json();

      if (data.success) {
        router.push(`/cases/${data.data.id}`);
      } else {
        setErrors({ submit: data.error?.message || '创建失败' });
      }
    } catch (error) {
      console.error('创建案件失败:', error);
      setErrors({ submit: '创建失败，请稍后重试' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push('/cases');
  };

  // 跳转到咨询详情
  const goToConsultation = () => {
    if (consultationData?.id) {
      router.push(`/consultations/${consultationData.id}`);
    }
  };

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black'>
      {/* 页面头部 */}
      <header className='border-b border-zinc-200 bg-white px-6 py-6 dark:border-zinc-800 dark:bg-zinc-950'>
        <div className='mx-auto max-w-5xl'>
          <h1 className='text-2xl font-semibold text-zinc-900 dark:text-zinc-50'>
            创建案件
          </h1>
          <p className='mt-1 text-sm text-zinc-600 dark:text-zinc-400'>
            录入新的案件信息
          </p>
        </div>
      </header>

      {/* 主内容区 */}
      <main className='mx-auto max-w-5xl px-6 py-8'>
        {/* 咨询转化提示 */}
        {consultationId && (
          <div className='mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-3'>
                <div className='flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-800'>
                  <FileText className='h-5 w-5 text-blue-600 dark:text-blue-400' />
                </div>
                <div>
                  <p className='font-medium text-blue-900 dark:text-blue-200'>
                    从咨询转化案件
                  </p>
                  <p className='text-sm text-blue-700 dark:text-blue-300'>
                    已自动填充咨询中的案情摘要和客户信息
                  </p>
                </div>
              </div>
              <Button
                variant='outline'
                size='sm'
                onClick={goToConsultation}
                className='flex items-center gap-2'
              >
                查看咨询
                <ArrowRight className='h-4 w-4' />
              </Button>
            </div>
            {isLoadingConsultation && (
              <p className='mt-2 text-sm text-blue-600 dark:text-blue-400'>
                正在加载咨询信息...
              </p>
            )}
            {consultationData && (
              <div className='mt-3 rounded bg-white p-3 dark:bg-zinc-800'>
                <p className='text-sm'>
                  <span className='font-medium'>客户：</span>
                  {consultationData.clientName}
                  {consultationData.clientPhone && (
                    <span className='ml-2 text-zinc-500'>
                      ({consultationData.clientPhone})
                    </span>
                  )}
                </p>
                <p className='mt-1 text-sm'>
                  <span className='font-medium'>案情摘要：</span>
                  {consultationData.caseSummary.substring(0, 100)}
                  {consultationData.caseSummary.length > 100 && '...'}
                </p>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className='space-y-6'>
            {/* 基本信息 */}
            <Card>
              <CardHeader>
                <CardTitle>基本信息</CardTitle>
              </CardHeader>
              <CardContent className='space-y-5'>
                <div className='grid gap-2'>
                  <Label htmlFor='title' className='text-base'>
                    案件标题 <span className='text-red-500'>*</span>
                  </Label>
                  <Input
                    id='title'
                    value={formData.title}
                    onChange={e => handleChange('title', e.target.value)}
                    placeholder='例如：张三诉李四合同纠纷案'
                    className='h-12 text-base'
                  />
                  {errors.title && (
                    <p className='text-sm text-red-500'>{errors.title}</p>
                  )}
                </div>

                <div className='grid grid-cols-2 gap-5'>
                  <div className='grid gap-2'>
                    <Label htmlFor='type' className='text-base'>
                      案件类型 <span className='text-red-500'>*</span>
                    </Label>
                    <select
                      id='type'
                      value={formData.type}
                      onChange={e => handleChange('type', e.target.value)}
                      className='flex h-12 w-full rounded-md border border-zinc-300 bg-white px-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950'
                    >
                      <option value='CIVIL'>民事案件</option>
                      <option value='CRIMINAL'>刑事案件</option>
                      <option value='ADMINISTRATIVE'>行政案件</option>
                      <option value='COMMERCIAL'>商事案件</option>
                      <option value='LABOR'>劳动案件</option>
                      <option value='INTELLECTUAL_PROPERTY'>
                        知识产权案件
                      </option>
                    </select>
                  </div>

                  <div className='grid gap-2'>
                    <Label htmlFor='status' className='text-base'>
                      案件状态
                    </Label>
                    <select
                      id='status'
                      value={formData.status}
                      onChange={e => handleChange('status', e.target.value)}
                      className='flex h-12 w-full rounded-md border border-zinc-300 bg-white px-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950'
                    >
                      <option value='DRAFT'>草稿</option>
                      <option value='ACTIVE'>进行中</option>
                      <option value='COMPLETED'>已完成</option>
                      <option value='ARCHIVED'>已归档</option>
                    </select>
                  </div>
                </div>

                <div className='grid gap-2'>
                  <div className='flex items-center justify-between'>
                    <Label htmlFor='caseNumber' className='text-base'>
                      案号
                    </Label>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={generateCaseNumber}
                      className='flex items-center gap-1 text-blue-600 hover:text-blue-700'
                    >
                      <RefreshCw className='h-3 w-3' />
                      自动生成
                    </Button>
                  </div>
                  <Input
                    id='caseNumber'
                    value={formData.caseNumber}
                    onChange={e => handleChange('caseNumber', e.target.value)}
                    placeholder='请先选择案件类型，再点击"自动生成"'
                    className='h-12 text-base'
                  />
                </div>

                <div className='grid gap-2'>
                  <div className='flex items-center justify-between'>
                    <Label htmlFor='description' className='text-base'>
                      案件描述
                    </Label>
                    <div className='flex gap-2'>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => setShowTemplates(!showTemplates)}
                        className='flex items-center gap-1 text-blue-600 hover:text-blue-700'
                      >
                        <FileStack className='h-3 w-3' />
                        模板
                      </Button>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={generateWithAI}
                        disabled={isGeneratingAI}
                        className='flex items-center gap-1 text-purple-600 hover:text-purple-700'
                      >
                        <Sparkles
                          className={`h-3 w-3 ${isGeneratingAI ? 'animate-spin' : ''}`}
                        />
                        {isGeneratingAI ? '生成中...' : 'AI生成'}
                      </Button>
                    </div>
                  </div>
                  {/* 模板选择面板 */}
                  {showTemplates && (
                    <div className='mb-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800'>
                      <p className='mb-2 text-sm text-zinc-600 dark:text-zinc-400'>
                        选择模板（将自动填充已填写的当事人信息）：
                      </p>
                      <div className='flex flex-wrap gap-2'>
                        {(caseDescriptionTemplates[formData.type] || []).map(
                          (tpl, idx) => (
                            <button
                              key={idx}
                              type='button'
                              onClick={() => applyTemplate(tpl.template)}
                              className='rounded-full border border-zinc-300 px-3 py-1 text-xs hover:border-blue-500 hover:bg-blue-50 dark:border-zinc-600 dark:hover:bg-blue-900'
                            >
                              {tpl.title}
                            </button>
                          )
                        )}
                        {commonTemplates.map((tpl, idx) => (
                          <button
                            key={`common-${idx}`}
                            type='button'
                            onClick={() => applyTemplate(tpl.template)}
                            className='rounded-full border border-zinc-300 px-3 py-1 text-xs hover:border-blue-500 hover:bg-blue-50 dark:border-zinc-600 dark:hover:bg-blue-900'
                          >
                            {tpl.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <textarea
                    id='description'
                    value={formData.description}
                    onChange={e => handleChange('description', e.target.value)}
                    placeholder={
                      consultationData?.caseSummary ||
                      '请详细描述案件情况...（您也可以点击上方"模板"或"AI生成"来快速创建）'
                    }
                    rows={5}
                    className='flex w-full rounded-md border border-zinc-300 bg-white px-3 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950'
                  />
                  {errors.description && (
                    <p className='text-sm text-red-500'>{errors.description}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 当事人信息 */}
            <Card>
              <CardHeader>
                <CardTitle>当事人信息</CardTitle>
              </CardHeader>
              <CardContent className='space-y-5'>
                <div className='grid grid-cols-2 gap-5'>
                  <div className='grid gap-2'>
                    <Label htmlFor='plaintiffName' className='text-base'>
                      原告/申请人
                    </Label>
                    <Input
                      id='plaintiffName'
                      value={formData.plaintiffName}
                      onChange={e =>
                        handleChange('plaintiffName', e.target.value)
                      }
                      placeholder='请输入原告姓名或单位名称'
                      className='h-12 text-base'
                    />
                  </div>

                  <div className='grid gap-2'>
                    <Label htmlFor='defendantName' className='text-base'>
                      被告/被申请人
                    </Label>
                    <Input
                      id='defendantName'
                      value={formData.defendantName}
                      onChange={e =>
                        handleChange('defendantName', e.target.value)
                      }
                      placeholder='请输入被告姓名或单位名称'
                      className='h-12 text-base'
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 案件信息 */}
            <Card>
              <CardHeader>
                <CardTitle>案件信息</CardTitle>
              </CardHeader>
              <CardContent className='space-y-5'>
                <div className='grid grid-cols-2 gap-5'>
                  <div className='grid gap-2'>
                    <Label htmlFor='cause' className='text-base'>
                      案由
                    </Label>
                    <Input
                      id='cause'
                      value={formData.cause}
                      onChange={e => handleChange('cause', e.target.value)}
                      placeholder='例如：合同纠纷'
                      className='h-12 text-base'
                    />
                  </div>

                  <div className='grid gap-2'>
                    <Label htmlFor='court' className='text-base'>
                      审理法院
                    </Label>
                    <Input
                      id='court'
                      value={formData.court}
                      onChange={e => handleChange('court', e.target.value)}
                      placeholder='例如：北京市朝阳区人民法院'
                      className='h-12 text-base'
                    />
                  </div>
                </div>

                <div className='grid gap-2'>
                  <Label htmlFor='amount' className='text-base'>
                    标的金额（元）
                  </Label>
                  <Input
                    id='amount'
                    inputMode='decimal'
                    autoComplete='off'
                    value={formData.amount}
                    onChange={e => handleChange('amount', e.target.value)}
                    placeholder='请输入金额（单位：元）'
                    className='h-12 text-base'
                  />
                </div>
              </CardContent>
            </Card>

            {/* 错误提示 */}
            {errors.submit && (
              <div className='rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400'>
                {errors.submit}
              </div>
            )}

            {/* 按钮组 */}
            <div className='flex justify-end gap-4 pt-4'>
              <Button
                type='button'
                variant='outline'
                size='lg'
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                取消
              </Button>
              <Button type='submit' size='lg' disabled={isSubmitting}>
                {isSubmitting ? '创建中...' : '创建案件'}
              </Button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
