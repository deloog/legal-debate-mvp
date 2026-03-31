'use client';

import { MemoryType } from '@prisma/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface Memory {
  id: string;
  memoryType: MemoryType;
  memoryKey: string;
  memoryValue: unknown;
  importance: number;
  accessCount: number;
  lastAccessedAt: string | null;
  expiresAt: string | null;
  compressed: boolean;
  compressionRatio: number | null;
  createdAt: string;
}

interface MemoryTableProps {
  memories: Memory[];
  loading?: boolean;
  selectedIds: string[];
  onSelectIds: (ids: string[]) => void;
  onDelete: (ids: string[]) => void;
}

const typeColors: Record<MemoryType, string> = {
  WORKING: 'bg-blue-500',
  HOT: 'bg-orange-500',
  COLD: 'bg-purple-500',
};

const typeLabels: Record<MemoryType, string> = {
  WORKING: 'Working',
  HOT: 'Hot',
  COLD: 'Cold',
};

export function MemoryTable({
  memories,
  loading,
  selectedIds,
  onSelectIds,
  onDelete,
}: MemoryTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === memories.length) {
      onSelectIds([]);
    } else {
      onSelectIds(memories.map(m => m.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectIds(selectedIds.filter(sid => sid !== id));
    } else {
      onSelectIds([...selectedIds, id]);
    }
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('zh-CN');
  };

  const formatValue = (value: unknown): string => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return JSON.stringify(parsed, null, 2).substring(0, 200) + '...';
      } catch {
        return value.substring(0, 200) + '...';
      }
    }
    return JSON.stringify(value, null, 2).substring(0, 200) + '...';
  };

  if (loading) {
    return (
      <div className='rounded-lg border bg-card'>
        <div className='p-8 text-center text-muted-foreground'>加载中...</div>
      </div>
    );
  }

  if (memories.length === 0) {
    return (
      <div className='rounded-lg border bg-card'>
        <div className='p-8 text-center text-muted-foreground'>
          暂无记忆数据
        </div>
      </div>
    );
  }

  return (
    <div className='rounded-lg border bg-card'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-12'>
              <Checkbox
                checked={
                  selectedIds.length === memories.length && memories.length > 0
                }
                onCheckedChange={toggleSelectAll}
              />
            </TableHead>
            <TableHead>类型</TableHead>
            <TableHead>Key</TableHead>
            <TableHead className='text-right'>重要性</TableHead>
            <TableHead className='text-right'>访问次数</TableHead>
            <TableHead>最后访问</TableHead>
            <TableHead>过期时间</TableHead>
            <TableHead className='text-right'>操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {memories.map(memory => (
            <>
              <TableRow
                key={memory.id}
                className={isExpired(memory.expiresAt) ? 'bg-red-50' : ''}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedIds.includes(memory.id)}
                    onCheckedChange={() => toggleSelect(memory.id)}
                  />
                </TableCell>
                <TableCell>
                  <Badge className={typeColors[memory.memoryType]}>
                    {typeLabels[memory.memoryType]}
                  </Badge>
                  {memory.compressed && (
                    <Badge variant='outline' className='ml-1 text-xs'>
                      压缩
                    </Badge>
                  )}
                </TableCell>
                <TableCell className='font-mono text-sm max-w-[200px] truncate'>
                  {memory.memoryKey}
                </TableCell>
                <TableCell className='text-right'>
                  {memory.importance.toFixed(2)}
                </TableCell>
                <TableCell className='text-right'>
                  {memory.accessCount}
                </TableCell>
                <TableCell className='text-sm'>
                  {formatDate(memory.lastAccessedAt)}
                </TableCell>
                <TableCell className='text-sm'>
                  <span
                    className={
                      isExpired(memory.expiresAt)
                        ? 'text-red-600 font-medium'
                        : ''
                    }
                  >
                    {formatDate(memory.expiresAt)}
                    {isExpired(memory.expiresAt) && ' (已过期)'}
                  </span>
                </TableCell>
                <TableCell className='text-right'>
                  <div className='flex items-center justify-end gap-1'>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => toggleExpand(memory.id)}
                    >
                      {expandedRows.has(memory.id) ? (
                        <ChevronUp className='h-4 w-4' />
                      ) : (
                        <ChevronDown className='h-4 w-4' />
                      )}
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => onDelete([memory.id])}
                      className='text-red-600 hover:text-red-700'
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              {expandedRows.has(memory.id) && (
                <TableRow className='bg-muted/50'>
                  <TableCell colSpan={8} className='p-4'>
                    <div className='space-y-2'>
                      <div className='text-sm font-medium'>记忆内容:</div>
                      <pre className='text-xs bg-muted p-2 rounded overflow-auto max-h-40'>
                        {formatValue(memory.memoryValue)}
                      </pre>
                      {memory.compressionRatio && (
                        <div className='text-sm text-muted-foreground'>
                          压缩比: {(memory.compressionRatio * 100).toFixed(1)}%
                        </div>
                      )}
                      <div className='text-xs text-muted-foreground'>
                        创建时间: {formatDate(memory.createdAt)} | ID:{' '}
                        {memory.id}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
