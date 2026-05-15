/**
 * 创建案件页面
 *
 * 功能：
 * 1. 基本信息：标题、类型、状态、案号、审理法院
 * 2. 当事人信息：原告、被告、案由、标的金额
 * 3. 智能录入：图片 OCR 识别 / 粘贴文字解析（AI 自动填充表单）
 * 4. 案情描述：支持模板填充和 AI 生成
 * 5. 支持从咨询转化案件（consultationId 参数）
 *
 * @page /cases/create
 */

'use client';

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
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
  Image as ImageIcon,
  Clipboard as ClipboardPaste,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

/** 案件类型代码映射（用于案号生成） */
const caseTypeCodes: Record<string, { code: string; name: string }> = {
  CIVIL: { code: 'M', name: '民' },
  CRIMINAL: { code: 'X', name: '刑' },
  ADMINISTRATIVE: { code: 'G', name: '行' },
  COMMERCIAL: { code: 'S', name: '商' },
  LABOR: { code: 'L', name: '劳' },
  INTELLECTUAL_PROPERTY: { code: 'Z', name: '知' },
};

const statusCodes: Record<string, string> = {
  DRAFT: '初',
  ACTIVE: '初',
  COMPLETED: '终',
  ARCHIVED: '决',
};

/** 案件描述模板（按案件类型分类） */
const caseDescriptionTemplates: Record<
  string,
  { title: string; template: string }[]
> = {
  CIVIL: [
    {
      title: '借贷纠纷',
      template:
        '原告{plaintiff}与被告{defendant}于{date}签订借款合同，约定被告向原告借款{amount}元。合同签订后，原告按约支付了借款，但被告未按期还款。',
    },
    {
      title: '合同纠纷',
      template:
        '原告{plaintiff}与被告{defendant}因{cause}合同发生纠纷。原告认为被告未按合同约定履行义务，造成原告损失。',
    },
    {
      title: '房产纠纷',
      template:
        '原告{plaintiff}与被告{defendant}就位于{location}的房产发生权属争议。双方多次协商未果，现向贵院提起诉讼。',
    },
    {
      title: '婚姻家庭',
      template:
        '原告{plaintiff}与被告{defendant}系夫妻关系，因{cause}导致感情破裂。双方就子女抚养、财产分割等问题无法达成一致。',
    },
    {
      title: '侵权责任',
      template:
        '被告{defendant}的行为造成原告{plaintiff}人身损害/财产损失。原告要求被告赔偿医疗费、误工费等各项损失共计{amount}元。',
    },
    {
      title: '交通事故',
      template:
        '{date}，被告{defendant}驾驶机动车与原告{plaintiff}发生交通事故，造成原告人身损害。原告要求被告赔偿各项费用。',
    },
    {
      title: '继承纠纷',
      template:
        '被继承人于{date}去世，留有遗产{amount}元及房产一处。原告{plaintiff}作为法定继承人，要求依法继承相应份额，被告{defendant}对遗产分配提出异议。',
    },
  ],
  CRIMINAL: [
    {
      title: '故意伤害',
      template:
        '犯罪嫌疑人{defendant}因{cause}与被害人{plaintiff}发生冲突，后实施伤害，造成被害人受伤。涉嫌故意伤害罪。',
    },
    {
      title: '盗窃',
      template:
        '犯罪嫌疑人{defendant}于{date}在{location}秘密窃取被害人{plaintiff}财物，涉案金额约{amount}元。涉嫌盗窃罪。',
    },
    {
      title: '诈骗',
      template:
        '犯罪嫌疑人{defendant}以非法占有为目的，骗取被害人{plaintiff}人民币{amount}元。涉嫌诈骗罪。',
    },
    {
      title: '危险驾驶',
      template:
        '犯罪嫌疑人{defendant}于{date}在{location}醉酒驾驶，涉嫌危险驾驶罪。',
    },
  ],
  LABOR: [
    {
      title: '劳动争议',
      template:
        '申请人{plaintiff}与被申请人{defendant}因{cause}发生劳动争议。申请人认为被申请人违法解除劳动合同，要求支付赔偿金{amount}元。',
    },
    {
      title: '工伤赔偿',
      template:
        '申请人{plaintiff}系被申请人{defendant}职工，在工作中因{cause}受伤，经认定为工伤，要求被申请人支付各项补偿共计{amount}元。',
    },
    {
      title: '拖欠工资',
      template:
        '申请人{plaintiff}在被申请人{defendant}处工作期间，被申请人拖欠工资{amount}元，要求支付拖欠工资及经济补偿金。',
    },
  ],
  COMMERCIAL: [
    {
      title: '商业合同违约',
      template:
        '原告{plaintiff}与被告{defendant}签订合同，合同签订后，原告已履行合同义务，但被告未按约定履行，构成违约，原告损失{amount}元。',
    },
    {
      title: '股权纠纷',
      template:
        '原告{plaintiff}与被告{defendant}因股权问题发生争议，原告认为被告侵害了其股东权益，要求被告停止侵害。',
    },
  ],
  ADMINISTRATIVE: [
    {
      title: '行政处罚异议',
      template:
        '原告{plaintiff}对相关部门作出的行政处罚决定不服，认为该处罚决定认定事实不清、适用法律错误，要求撤销。',
    },
    {
      title: '行政许可',
      template:
        '原告{plaintiff}向相关部门申请行政许可，相关部门不予许可/不予答复，原告认为违反法律规定，要求其履行许可职责。',
    },
  ],
  INTELLECTUAL_PROPERTY: [
    {
      title: '著作权侵权',
      template:
        '原告{plaintiff}依法享有相关作品的著作权。被告{defendant}未经原告许可，擅自使用该作品，侵犯了原告的著作权，要求赔偿损失{amount}元。',
    },
    {
      title: '专利侵权',
      template:
        '原告{plaintiff}依法享有相关专利权。被告{defendant}生产、销售的产品落入原告专利保护范围，要求被告停止侵权并赔偿损失。',
    },
  ],
};

const commonTemplates = [
  {
    title: '通用模板',
    template:
      '本案系{type}案件。原告{plaintiff}与被告{defendant}因{cause}发生争议，请求法院依法判决。',
  },
];

/** 智能录入模式 */
type SmartInputMode = 'image' | 'text';

/** 提取结果字段 */
interface ExtractedFields {
  title?: string;
  plaintiffName?: string;
  defendantName?: string;
  cause?: string;
  court?: string;
  amount?: string;
  description?: string;
  caseNumber?: string;
}

export default function CreateCasePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const consultationId = searchParams.get('consultationId');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const extractSuccessTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

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

  // 智能录入状态
  const [smartMode, setSmartMode] = useState<SmartInputMode>('text');
  const [pasteText, setPasteText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractSuccess, setExtractSuccess] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<{
    base64: string;
    mimeType: string;
  } | null>(null);

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
          const data = (await response.json()) as {
            data: {
              caseSummary?: string;
              clientName?: string;
              clientPhone?: string;
              id: string;
            };
          };
          const consultation = data.data;
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
      } catch {
        // 咨询数据加载失败不影响创建表单的主流程，静默忽略
      } finally {
        setIsLoadingConsultation(false);
      }
    }
    fetchConsultation();
  }, [consultationId]);

  // 组件卸载时清理 extractSuccess 定时器，避免在已卸载组件上调用 setState
  useEffect(() => {
    return () => {
      if (extractSuccessTimer.current) {
        clearTimeout(extractSuccessTimer.current);
      }
    };
  }, []);

  // 自动生成案号
  const generateCaseNumber = async () => {
    try {
      const response = await fetch(
        `/api/v1/cases/generate-case-number?type=${formData.type}`
      );
      const data = (await response.json()) as {
        success: boolean;
        data: { caseNumber: string };
      };
      if (data.success && data.data.caseNumber) {
        setFormData(prev => ({ ...prev, caseNumber: data.data.caseNumber }));
      } else {
        const year = new Date().getFullYear();
        const typeInfo = caseTypeCodes[formData.type] || {
          code: 'M',
          name: '民',
        };
        const statusCode = statusCodes[formData.status] || '初';
        const randomNum = Math.floor(Math.random() * 9000 + 1000);
        setFormData(prev => ({
          ...prev,
          caseNumber: `${year}${typeInfo.code}${typeInfo.name}${statusCode}${randomNum}号`,
        }));
      }
    } catch {
      const year = new Date().getFullYear();
      const typeInfo = caseTypeCodes[formData.type] || {
        code: 'M',
        name: '民',
      };
      const statusCode = statusCodes[formData.status] || '初';
      const randomNum = Math.floor(Math.random() * 9000 + 1000);
      setFormData(prev => ({
        ...prev,
        caseNumber: `${year}${typeInfo.code}${typeInfo.name}${statusCode}${randomNum}号`,
      }));
    }
  };

  // 应用模板
  const applyTemplate = (template: string) => {
    const typeLabel =
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
                : '知识产权';
    const filled = template
      .replace(/{plaintiff}/g, formData.plaintiffName || '原告')
      .replace(/{defendant}/g, formData.defendantName || '被告')
      .replace(/{cause}/g, formData.cause || '相关')
      .replace(/{amount}/g, formData.amount || '待定')
      .replace(/{date}/g, new Date().toLocaleDateString('zh-CN'))
      .replace(/{location}/g, '待定')
      .replace(/{result}/g, '待定')
      .replace(/{type}/g, typeLabel);
    setFormData(prev => ({ ...prev, description: filled }));
    setShowTemplates(false);
  };

  // AI 生成案情描述
  const generateWithAI = async () => {
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
      const data = (await response.json()) as {
        success: boolean;
        data: { description: string };
      };
      if (data.success && data.data.description) {
        setFormData(prev => ({ ...prev, description: data.data.description }));
      } else {
        const templates =
          caseDescriptionTemplates[formData.type] || commonTemplates;
        applyTemplate(templates[0]?.template || commonTemplates[0].template);
      }
    } catch {
      const templates =
        caseDescriptionTemplates[formData.type] || commonTemplates;
      applyTemplate(templates[0]?.template || commonTemplates[0].template);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // 将提取结果填入表单
  const applyExtracted = (fields: ExtractedFields) => {
    setFormData(prev => ({
      ...prev,
      title: fields.title || prev.title,
      plaintiffName: fields.plaintiffName || prev.plaintiffName,
      defendantName: fields.defendantName || prev.defendantName,
      cause: fields.cause || prev.cause,
      court: fields.court || prev.court,
      amount: fields.amount || prev.amount,
      description: fields.description || prev.description,
      caseNumber: fields.caseNumber || prev.caseNumber,
    }));
    setExtractSuccess(true);
    if (extractSuccessTimer.current) clearTimeout(extractSuccessTimer.current);
    extractSuccessTimer.current = setTimeout(
      () => setExtractSuccess(false),
      3000
    );
  };

  // 粘贴文字解析
  const handleTextExtract = async () => {
    if (!pasteText.trim()) return;
    setIsExtracting(true);
    setErrors(prev => ({ ...prev, smartExtract: '' }));
    try {
      const response = await fetch('/api/v1/cases/smart-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'text', content: pasteText }),
      });
      const data = (await response.json()) as {
        success: boolean;
        data: ExtractedFields;
        error?: string;
      };
      if (data.success && data.data) {
        applyExtracted(data.data);
      } else {
        setErrors(prev => ({
          ...prev,
          smartExtract: data.error || '解析失败',
        }));
      }
    } catch {
      setErrors(prev => ({ ...prev, smartExtract: '解析失败，请稍后重试' }));
    } finally {
      setIsExtracting(false);
    }
  };

  // 图片选择处理
  const handleImageSelect = (file: File) => {
    // 客户端预验证：文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setErrors(prev => ({
        ...prev,
        smartExtract: '仅支持 JPG、PNG、WEBP 格式的图片',
      }));
      return;
    }
    // 客户端预验证：文件大小（10MB 上限）
    if (file.size > 10 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, smartExtract: '图片文件不能超过 10MB' }));
      return;
    }
    setErrors(prev => ({ ...prev, smartExtract: '' }));

    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      // 取逗号后的纯 base64 部分（FileReader.readAsDataURL 保证格式为 data:mime;base64,xxx）
      const commaIndex = dataUrl.indexOf(',');
      const base64 =
        commaIndex !== -1 ? dataUrl.slice(commaIndex + 1) : dataUrl;
      setImageData({ base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  // 图片 OCR 识别
  const handleImageExtract = async () => {
    if (!imageData) return;
    setIsExtracting(true);
    setErrors(prev => ({ ...prev, smartExtract: '' }));
    try {
      const response = await fetch('/api/v1/cases/smart-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'image',
          content: imageData.base64,
          mimeType: imageData.mimeType,
        }),
      });
      const data = (await response.json()) as {
        success: boolean;
        data: ExtractedFields;
        error?: string;
      };
      if (data.success && data.data) {
        applyExtracted(data.data);
      } else {
        setErrors(prev => ({
          ...prev,
          smartExtract: data.error || '图片识别失败',
        }));
      }
    } catch {
      setErrors(prev => ({
        ...prev,
        smartExtract: '图片识别失败，请稍后重试',
      }));
    } finally {
      setIsExtracting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.title.trim()) newErrors.title = '请输入案件标题';
    if (!formData.type) newErrors.type = '请选择案件类型';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/v1/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: formData.amount ? parseFloat(formData.amount) : null,
          metadata: consultationId ? { consultationId } : {},
        }),
      });
      const data = (await response.json()) as {
        success: boolean;
        data: { id: string };
        error?: { message: string };
      };
      if (data.success) {
        router.push(`/cases/${data.data.id}`);
      } else {
        setErrors({ submit: data.error?.message || '创建失败' });
      }
    } catch {
      setErrors({ submit: '创建失败，请稍后重试' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectClassName =
    'flex h-12 w-full rounded-md border border-zinc-300 bg-white px-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950';

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black'>
      {/* 页面头部 */}
      <header className='border-b border-zinc-200 bg-white px-6 py-6 dark:border-zinc-800 dark:bg-zinc-950'>
        <div className='mx-auto max-w-3xl'>
          <h1 className='text-2xl font-semibold text-zinc-900 dark:text-zinc-50'>
            创建案件
          </h1>
          <p className='mt-1 text-sm text-zinc-600 dark:text-zinc-400'>
            录入新的案件信息
          </p>
        </div>
      </header>

      <main className='mx-auto max-w-3xl px-6 py-8'>
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
                onClick={() =>
                  consultationData &&
                  router.push(`/consultations/${consultationData.id}`)
                }
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
            {/* ── 第一部分：基本信息 ── */}
            <Card>
              <CardHeader>
                <CardTitle>基本信息</CardTitle>
              </CardHeader>
              <CardContent className='space-y-5'>
                {/* 案件标题 */}
                <div className='grid gap-2'>
                  <Label htmlFor='title' className='text-base'>
                    案件标题 <span className='text-red-500'>*</span>
                  </Label>
                  <Input
                    id='title'
                    value={formData.title}
                    onChange={e => handleChange('title', e.target.value)}
                    placeholder='例如：张三诉李四民间借贷纠纷案'
                    className='h-12 text-base'
                  />
                  {errors.title && (
                    <p className='text-sm text-red-500'>{errors.title}</p>
                  )}
                </div>

                {/* 案件类型 + 案件状态 */}
                <div className='grid grid-cols-2 gap-5'>
                  <div className='grid gap-2'>
                    <Label htmlFor='type' className='text-base'>
                      案件类型 <span className='text-red-500'>*</span>
                    </Label>
                    <select
                      id='type'
                      value={formData.type}
                      onChange={e => handleChange('type', e.target.value)}
                      className={selectClassName}
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
                      className={selectClassName}
                    >
                      <option value='DRAFT'>草稿</option>
                      <option value='ACTIVE'>进行中</option>
                      <option value='COMPLETED'>已完成</option>
                      <option value='ARCHIVED'>已归档</option>
                    </select>
                  </div>
                </div>

                {/* 案号 + 审理法院 */}
                <div className='grid grid-cols-2 gap-5'>
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
                      placeholder='请先选择类型再点击"自动生成"'
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
              </CardContent>
            </Card>

            {/* ── 第二部分：当事人信息 ── */}
            <Card>
              <CardHeader>
                <CardTitle>当事人信息</CardTitle>
              </CardHeader>
              <CardContent className='space-y-5'>
                {/* 原告 + 被告 */}
                <div className='grid grid-cols-2 gap-5'>
                  <div className='grid gap-2'>
                    <Label htmlFor='plaintiffName' className='text-base'>
                      原告 / 申请人
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
                      被告 / 被申请人
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

                {/* 案由 + 标的金额 */}
                <div className='grid grid-cols-2 gap-5'>
                  <div className='grid gap-2'>
                    <Label htmlFor='cause' className='text-base'>
                      案由
                    </Label>
                    <Input
                      id='cause'
                      value={formData.cause}
                      onChange={e => handleChange('cause', e.target.value)}
                      placeholder='例如：民间借贷纠纷'
                      className='h-12 text-base'
                    />
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
                </div>
              </CardContent>
            </Card>

            {/* ── 第三部分：智能录入 ── */}
            <Card>
              <CardHeader>
                <div className='flex items-center justify-between'>
                  <CardTitle>智能录入</CardTitle>
                  <p className='text-sm text-zinc-500'>
                    AI 自动识别并填充上方表单字段
                  </p>
                </div>
              </CardHeader>
              <CardContent className='space-y-4'>
                {/* 模式切换 */}
                <div className='flex rounded-lg border border-zinc-200 p-1 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 w-fit gap-1'>
                  <button
                    type='button'
                    onClick={() => {
                      setSmartMode('text');
                      setErrors(prev => ({ ...prev, smartExtract: '' }));
                    }}
                    className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                      smartMode === 'text'
                        ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50'
                        : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
                    }`}
                  >
                    <ClipboardPaste className='h-4 w-4' />
                    粘贴文字
                  </button>
                  <button
                    type='button'
                    onClick={() => {
                      setSmartMode('image');
                      setErrors(prev => ({ ...prev, smartExtract: '' }));
                    }}
                    className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                      smartMode === 'image'
                        ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50'
                        : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
                    }`}
                  >
                    <ImageIcon className='h-4 w-4' />
                    图片识别
                  </button>
                </div>

                {/* 粘贴文字面板 */}
                {smartMode === 'text' && (
                  <div className='space-y-3'>
                    <textarea
                      value={pasteText}
                      onChange={e => setPasteText(e.target.value)}
                      placeholder={
                        '请粘贴案件相关文字材料，例如：\n起诉状、一审判决书、案件摘要、当事人信息等\n\nAI 将自动识别并提取：原告、被告、案由、金额、法院、案号等信息'
                      }
                      rows={7}
                      className='flex w-full rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 resize-none'
                    />
                    <Button
                      type='button'
                      onClick={handleTextExtract}
                      disabled={!pasteText.trim() || isExtracting}
                      className='flex items-center gap-2'
                    >
                      {isExtracting ? (
                        <>
                          <Loader2 className='h-4 w-4 animate-spin' />
                          解析中...
                        </>
                      ) : (
                        <>
                          <Sparkles className='h-4 w-4' />
                          AI 解析并填充
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* 图片识别面板 */}
                {smartMode === 'image' && (
                  <div className='space-y-3'>
                    {/* 拖拽/点击上传区 */}
                    <div
                      onClick={() => imageInputRef.current?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault();
                        const file = e.dataTransfer.files[0];
                        if (file) handleImageSelect(file);
                      }}
                      className='relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 py-10 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors dark:border-zinc-600 dark:bg-zinc-900 dark:hover:border-blue-500 dark:hover:bg-blue-950'
                    >
                      {imagePreview ? (
                        <Image
                          src={imagePreview}
                          alt='预览'
                          width={640}
                          height={320}
                          unoptimized
                          className='max-h-48 max-w-full rounded-lg object-contain'
                        />
                      ) : (
                        <>
                          <ImageIcon className='h-10 w-10 text-zinc-400 mb-3' />
                          <p className='text-sm font-medium text-zinc-600 dark:text-zinc-400'>
                            点击或拖拽图片到此处
                          </p>
                          <p className='text-xs text-zinc-400 mt-1'>
                            支持 JPG、PNG、WEBP 格式
                          </p>
                        </>
                      )}
                      <input
                        ref={imageInputRef}
                        type='file'
                        accept='image/*'
                        className='hidden'
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleImageSelect(file);
                        }}
                      />
                    </div>
                    {imagePreview && (
                      <div className='flex gap-2'>
                        <Button
                          type='button'
                          onClick={handleImageExtract}
                          disabled={isExtracting}
                          className='flex items-center gap-2'
                        >
                          {isExtracting ? (
                            <>
                              <Loader2 className='h-4 w-4 animate-spin' />
                              识别中...
                            </>
                          ) : (
                            <>
                              <Sparkles className='h-4 w-4' />
                              AI 识别并填充
                            </>
                          )}
                        </Button>
                        <Button
                          type='button'
                          variant='outline'
                          onClick={() => {
                            setImagePreview(null);
                            setImageData(null);
                          }}
                        >
                          重新选择
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* 成功提示 */}
                {extractSuccess && (
                  <div className='flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'>
                    <CheckCircle2 className='h-4 w-4 shrink-0' />
                    <span className='text-sm'>
                      已提取信息并填充到上方表单，请检查并补充。
                    </span>
                  </div>
                )}

                {/* 错误提示 */}
                {errors.smartExtract && (
                  <p className='text-sm text-red-500'>{errors.smartExtract}</p>
                )}
              </CardContent>
            </Card>

            {/* ── 第四部分：案情描述 ── */}
            <Card>
              <CardHeader>
                <CardTitle>案情描述</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='grid gap-3'>
                  <div className='flex items-center justify-between'>
                    <p className='text-sm text-zinc-500'>
                      填写完以上信息后，可使用模板或 AI 快速生成案情描述
                    </p>
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
                        {isGeneratingAI ? '生成中...' : 'AI 生成'}
                      </Button>
                    </div>
                  </div>

                  {/* 模板选择面板 */}
                  {showTemplates && (
                    <div className='rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800'>
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
                      '请详细描述案件情况...（也可通过上方"模板"或"AI生成"快速创建）'
                    }
                    rows={6}
                    className='flex w-full rounded-md border border-zinc-300 bg-white px-3 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950'
                  />
                  {errors.description && (
                    <p className='text-sm text-red-500'>{errors.description}</p>
                  )}
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
                onClick={() => router.push('/cases')}
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
