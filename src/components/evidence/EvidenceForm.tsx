/**
 * EvidenceForm - 证据表单组件
 *
 * 功能：创建和编辑证据，支持文件上传和表单验证
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import type {
  CreateEvidenceInput,
  UpdateEvidenceInput,
  EvidenceDetail,
} from '@/types/evidence';
import { EvidenceType, EvidenceStatus } from '@/types/evidence';
import { Button } from '@/components/ui/button';

interface EvidenceFormProps {
  /**
   * 案件ID
   */
  caseId: string;

  /**
   * 编辑模式：传入证据详情
   */
  evidence?: EvidenceDetail;

  /**
   * 提交成功回调
   */
  onSubmitSuccess?: (evidence: EvidenceDetail) => void;

  /**
   * 取消回调
   */
  onCancel?: () => void;

  /**
   * 是否显示草稿保存按钮
   */
  showDraftButton?: boolean;
}

/**
 * 表单状态
 */
interface FormData {
  type: EvidenceType;
  name: string;
  description: string;
  submitter: string;
  source: string;
  fileUrl: string;
  fileName: string;
  relevanceScore: number | string;
  metadata: Record<string, unknown>;
}

/**
 * 表单验证错误
 */
interface FormErrors {
  type?: string;
  name?: string;
  submitter?: string;
  fileUrl?: string;
  relevanceScore?: string;
}

/**
 * 证据表单组件
 */
export function EvidenceForm({
  caseId,
  evidence,
  onSubmitSuccess,
  onCancel,
  showDraftButton = true,
}: EvidenceFormProps) {
  const [formData, setFormData] = useState<FormData>({
    type: EvidenceType.DOCUMENT,
    name: '',
    description: '',
    submitter: '',
    source: '',
    fileUrl: '',
    fileName: '',
    relevanceScore: '',
    metadata: {},
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [previewMode, setPreviewMode] = useState<boolean>(false);

  /**
   * 初始化表单数据（编辑模式）
   */
  useEffect(() => {
    if (evidence) {
      setFormData({
        type: (evidence.type as EvidenceType) || EvidenceType.DOCUMENT,
        name: evidence.name || '',
        description: evidence.description || '',
        submitter: evidence.submitter || '',
        source: evidence.source || '',
        fileUrl: evidence.fileUrl || '',
        fileName: '',
        relevanceScore: evidence.relevanceScore || '',
        metadata: (evidence.metadata as Record<string, unknown>) || {},
      });
    }
  }, [evidence]);

  /**
   * 验证表单
   */
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.type) {
      newErrors.type = '请选择证据类型';
    }

    if (!formData.name || formData.name.trim().length === 0) {
      newErrors.name = '证据名称不能为空';
    } else if (formData.name.length > 200) {
      newErrors.name = '证据名称不能超过200个字符';
    }

    if (!formData.submitter || formData.submitter.trim().length === 0) {
      newErrors.submitter = '提交人不能为空';
    } else if (formData.submitter.length > 100) {
      newErrors.submitter = '提交人不能超过100个字符';
    }

    if (!formData.fileUrl && formData.type !== EvidenceType.WITNESS) {
      newErrors.fileUrl = '请上传证据文件';
    }

    if (
      formData.relevanceScore !== '' &&
      (Number(formData.relevanceScore) < 0 ||
        Number(formData.relevanceScore) > 1)
    ) {
      newErrors.relevanceScore = '相关性评分必须在0-1之间';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  /**
   * 文件上传处理
   */
  const handleFileUpload = useCallback(async (file: File) => {
    setUploading(true);
    setErrors(prev => ({ ...prev, fileUrl: '' }));

    try {
      const formDataObj = new FormData();
      formDataObj.append('file', file);

      const response = await fetch('/api/evidence/upload', {
        method: 'POST',
        credentials: 'include',
        body: formDataObj,
      });

      if (!response.ok) {
        const errorData = await response.json();
        setErrors(prev => ({
          ...prev,
          fileUrl: errorData.message || '文件上传失败',
        }));
        return;
      }

      const data = await response.json();
      setFormData(prev => ({
        ...prev,
        fileUrl: data.fileUrl,
        fileName: file.name,
      }));
    } catch (err) {
      setErrors(prev => ({
        ...prev,
        fileUrl: err instanceof Error ? err.message : '文件上传失败',
      }));
    } finally {
      setUploading(false);
    }
  }, []);

  /**
   * 文件选择处理
   */
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) {
        return;
      }

      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        setErrors(prev => ({
          ...prev,
          fileUrl: '文件大小不能超过10MB',
        }));
        return;
      }

      handleFileUpload(file);
    },
    [handleFileUpload]
  );

  /**
   * 表单提交处理
   */
  const handleSubmit = useCallback(
    async (draft = false) => {
      if (!validateForm()) {
        return;
      }

      setLoading(true);
      setErrors({});

      try {
        const submitData: CreateEvidenceInput | UpdateEvidenceInput = {
          type: formData.type,
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          submitter: formData.submitter.trim(),
          source: formData.source.trim() || undefined,
          fileUrl: formData.fileUrl || undefined,
          relevanceScore:
            formData.relevanceScore !== ''
              ? Number(formData.relevanceScore)
              : undefined,
          metadata: formData.metadata,
        };

        let url: string;
        let method: string;

        if (evidence) {
          url = `/api/evidence/${evidence.id}`;
          method = 'PUT';
        } else {
          url = '/api/evidence';
          method = 'POST';
        }

        if (method === 'POST') {
          (submitData as CreateEvidenceInput).caseId = caseId;
          if (draft) {
            (submitData as CreateEvidenceInput).status = EvidenceStatus.PENDING;
          }
        }

        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(submitData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          setErrors(prev => ({
            ...prev,
            name: errorData.message || '提交失败',
          }));
          return;
        }

        const result = await response.json();
        const evidenceData = result.data as EvidenceDetail;

        if (onSubmitSuccess) {
          onSubmitSuccess(evidenceData);
        }
      } catch (err) {
        setErrors(prev => ({
          ...prev,
          name: err instanceof Error ? err.message : '提交失败',
        }));
      } finally {
        setLoading(false);
      }
    },
    [validateForm, formData, evidence, caseId, onSubmitSuccess]
  );

  /**
   * 处理字段变化
   */
  const handleFieldChange = useCallback(
    (
      field: keyof FormData,
      value: string | EvidenceType | number | Record<string, unknown>
    ) => {
      setFormData(prev => ({ ...prev, [field]: value }));
      setErrors(prev => ({ ...prev, [field]: '' }));
    },
    []
  );

  /**
   * 切换预览模式
   */
  const togglePreview = useCallback(() => {
    setPreviewMode(prev => !prev);
  }, []);

  /**
   * 重置表单
   */
  const handleReset = useCallback(() => {
    setFormData({
      type: EvidenceType.DOCUMENT,
      name: '',
      description: '',
      submitter: '',
      source: '',
      fileUrl: '',
      fileName: '',
      relevanceScore: '',
      metadata: {},
    });
    setErrors({});
  }, []);

  if (previewMode) {
    return (
      <div className='evidence-form evidence-form-preview'>
        <div className='preview-header'>
          <h2>证据预览</h2>
          <Button size='sm' variant='outline' onClick={togglePreview}>
            返回编辑
          </Button>
        </div>

        <div className='preview-content'>
          <div className='preview-item'>
            <label>证据类型:</label>
            <span>{formData.type}</span>
          </div>
          <div className='preview-item'>
            <label>证据名称:</label>
            <span>{formData.name}</span>
          </div>
          <div className='preview-item'>
            <label>描述:</label>
            <span>{formData.description || '-'}</span>
          </div>
          <div className='preview-item'>
            <label>提交人:</label>
            <span>{formData.submitter}</span>
          </div>
          <div className='preview-item'>
            <label>来源:</label>
            <span>{formData.source || '-'}</span>
          </div>
          <div className='preview-item'>
            <label>相关性评分:</label>
            <span>
              {formData.relevanceScore !== ''
                ? `${(Number(formData.relevanceScore) * 100).toFixed(1)}%`
                : '-'}
            </span>
          </div>
          {formData.fileUrl && (
            <div className='preview-item'>
              <label>附件:</label>
              <a
                href={formData.fileUrl}
                target='_blank'
                rel='noopener noreferrer'
              >
                {formData.fileName || '查看文件'}
              </a>
            </div>
          )}
        </div>

        <div className='form-actions'>
          <Button variant='outline' onClick={togglePreview}>
            返回编辑
          </Button>
          <Button
            variant='primary'
            onClick={() => handleSubmit(false)}
            disabled={loading}
          >
            {loading ? '提交中...' : '提交'}
          </Button>
          {showDraftButton && (
            <Button
              variant='outline'
              onClick={() => handleSubmit(true)}
              disabled={loading}
            >
              保存草稿
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className='evidence-form'>
      <div className='form-header'>
        <h2>{evidence ? '编辑证据' : '新建证据'}</h2>
        <div className='header-actions'>
          <Button size='sm' variant='ghost' onClick={togglePreview}>
            预览
          </Button>
          {onCancel && (
            <Button size='sm' variant='ghost' onClick={onCancel}>
              取消
            </Button>
          )}
        </div>
      </div>

      <form
        onSubmit={e => {
          e.preventDefault();
          handleSubmit(false);
        }}
      >
        <div className='form-group'>
          <label htmlFor='type'>
            证据类型 <span className='required'>*</span>
          </label>
          <select
            id='type'
            value={formData.type}
            onChange={e =>
              handleFieldChange('type', e.target.value as EvidenceType)
            }
            className={errors.type ? 'error' : ''}
          >
            <option value={EvidenceType.DOCUMENT}>书证</option>
            <option value={EvidenceType.PHYSICAL}>物证</option>
            <option value={EvidenceType.WITNESS}>证人证言</option>
            <option value={EvidenceType.EXPERT_OPINION}>鉴定意见</option>
            <option value={EvidenceType.AUDIO_VIDEO}>音视频</option>
            <option value={EvidenceType.OTHER}>其他</option>
          </select>
          {errors.type && <span className='error-text'>{errors.type}</span>}
        </div>

        <div className='form-group'>
          <label htmlFor='name'>
            证据名称 <span className='required'>*</span>
          </label>
          <input
            id='name'
            type='text'
            value={formData.name}
            onChange={e => handleFieldChange('name', e.target.value)}
            placeholder='请输入证据名称'
            maxLength={200}
            className={errors.name ? 'error' : ''}
          />
          {errors.name && <span className='error-text'>{errors.name}</span>}
          <span className='char-count'>{formData.name.length}/200</span>
        </div>

        <div className='form-group'>
          <label htmlFor='description'>描述</label>
          <textarea
            id='description'
            value={formData.description}
            onChange={e => handleFieldChange('description', e.target.value)}
            placeholder='请输入证据描述'
            maxLength={5000}
            rows={4}
          />
          <span className='char-count'>{formData.description.length}/5000</span>
        </div>

        <div className='form-group'>
          <label htmlFor='submitter'>
            提交人 <span className='required'>*</span>
          </label>
          <input
            id='submitter'
            type='text'
            value={formData.submitter}
            onChange={e => handleFieldChange('submitter', e.target.value)}
            placeholder='请输入提交人'
            maxLength={100}
            className={errors.submitter ? 'error' : ''}
          />
          {errors.submitter && (
            <span className='error-text'>{errors.submitter}</span>
          )}
        </div>

        <div className='form-group'>
          <label htmlFor='source'>来源</label>
          <input
            id='source'
            type='text'
            value={formData.source}
            onChange={e => handleFieldChange('source', e.target.value)}
            placeholder='请输入证据来源'
            maxLength={200}
          />
        </div>

        <div className='form-group'>
          <label htmlFor='relevanceScore'>相关性评分 (0-1)</label>
          <input
            id='relevanceScore'
            type='number'
            step='0.01'
            min='0'
            max='1'
            value={formData.relevanceScore}
            onChange={e => handleFieldChange('relevanceScore', e.target.value)}
            placeholder='请输入相关性评分 (0-1)'
            className={errors.relevanceScore ? 'error' : ''}
          />
          {errors.relevanceScore && (
            <span className='error-text'>{errors.relevanceScore}</span>
          )}
        </div>

        <div className='form-group'>
          <label htmlFor='file'>
            证据文件 <span className='required'>*</span>
          </label>
          <input
            id='file'
            type='file'
            onChange={handleFileSelect}
            disabled={uploading}
            className={errors.fileUrl ? 'error' : ''}
          />
          {uploading && <span className='uploading-text'>上传中...</span>}
          {formData.fileUrl && !uploading && (
            <div className='file-info'>
              <span>已上传: {formData.fileName}</span>
              <a
                href={formData.fileUrl}
                target='_blank'
                rel='noopener noreferrer'
              >
                查看文件
              </a>
            </div>
          )}
          {errors.fileUrl && (
            <span className='error-text'>{errors.fileUrl}</span>
          )}
        </div>

        <div className='form-actions'>
          {onCancel && (
            <Button variant='outline' type='button' onClick={onCancel}>
              取消
            </Button>
          )}
          <Button variant='outline' type='button' onClick={handleReset}>
            重置
          </Button>
          {showDraftButton && (
            <Button
              variant='outline'
              type='button'
              onClick={() => handleSubmit(true)}
              disabled={loading}
            >
              保存草稿
            </Button>
          )}
          <Button variant='primary' type='submit' disabled={loading}>
            {loading ? '提交中...' : '提交'}
          </Button>
        </div>
      </form>
    </div>
  );
}
