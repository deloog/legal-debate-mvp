/**
 * 案件共享对话框组件
 * 用于共享案件给团队
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Share as ShareIcon } from 'lucide-react';
import { toast } from 'sonner';

interface CaseShareDialogProps {
  caseId: string;
  caseTitle: string;
  isOwner: boolean;
  sharedWithTeam: boolean;
  onShared: (shared: boolean) => void;
}

/**
 * 共享对话框组件
 */
export function CaseShareDialog({
  caseId,
  caseTitle,
  isOwner,
  sharedWithTeam: initialSharedWithTeam,
  onShared,
}: CaseShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [sharedWithTeam, setSharedWithTeam] = useState(initialSharedWithTeam);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // 处理保存
  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/cases/${caseId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sharedWithTeam,
          notes,
        }),
      });

      if (!response.ok) {
        throw new Error('共享案件失败');
      }

      const data = await response.json();
      if (data.success) {
        toast.success(
          data.data.message ||
            (sharedWithTeam ? '案件已共享给团队' : '案件共享已取消')
        );
        onShared(sharedWithTeam);
        setOpen(false);
      }
    } catch (error) {
      console.error('共享案件时出错:', error);
      const errorMessage =
        error instanceof Error ? error.message : '共享案件失败';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // 打开对话框时重置状态
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setSharedWithTeam(initialSharedWithTeam);
      setNotes('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant='outline' size='sm'>
          <ShareIcon className='h-4 w-4 mr-2' />
          共享案件
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-106.25'>
        <DialogHeader>
          <DialogTitle>共享案件</DialogTitle>
          <DialogDescription>
            将案件&ldquo;{caseTitle}&rdquo;共享给您的团队成员
          </DialogDescription>
        </DialogHeader>

        {!isOwner && (
          <div className='text-sm text-muted-foreground'>
            只有案件所有者可以修改共享设置
          </div>
        )}

        <div className='space-y-4 py-4'>
          {/* 共享开关 */}
          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label htmlFor='share-toggle'>共享给团队</Label>
              <div className='text-xs text-muted-foreground'>
                {sharedWithTeam
                  ? '团队成员可以访问此案件'
                  : '只有您可以访问此案件'}
              </div>
            </div>
            <Switch
              id='share-toggle'
              checked={sharedWithTeam}
              onCheckedChange={setSharedWithTeam}
              disabled={!isOwner || saving}
            />
          </div>

          {/* 共享说明 */}
          {sharedWithTeam && (
            <div className='space-y-2'>
              <Label htmlFor='share-notes'>共享说明（可选）</Label>
              <Textarea
                id='share-notes'
                placeholder='添加共享说明，例如：需要团队协作完成此案件'
                value={notes}
                onChange={e => setNotes(e.target.value)}
                disabled={!isOwner || saving}
                maxLength={500}
                rows={3}
              />
              <div className='text-xs text-muted-foreground text-right'>
                {notes.length}/500
              </div>
            </div>
          )}

          {/* 权限说明 */}
          {sharedWithTeam && (
            <div className='bg-muted p-3 rounded-md space-y-1'>
              <div className='text-sm font-medium'>权限说明：</div>
              <ul className='text-xs text-muted-foreground list-disc list-inside space-y-1'>
                <li>共享后，团队成员可以根据其在团队中的角色访问此案件</li>
                <li>您可以随时取消共享，取消后团队成员将无法访问</li>
                <li>案件所有者始终拥有完全控制权</li>
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving || !isOwner}>
            {saving ? '保存中...' : sharedWithTeam ? '共享' : '取消共享'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
