'use client';

import { useState, useEffect } from 'react';
import {
  NotificationChannel,
  ReminderPreferences,
  type CourtScheduleReminderConfig,
  type DeadlineReminderConfig,
  type FollowUpReminderConfig,
} from '@/types/notification';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface ReminderSettingsProps {
  userId: string;
}

export function ReminderSettings({ userId }: ReminderSettingsProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [preferences, setPreferences] = useState<ReminderPreferences>({
    courtSchedule: {
      enabled: true,
      hoursBefore: [24, 1],
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    },
    deadline: {
      enabled: true,
      daysBefore: [7, 3, 1],
      channels: [NotificationChannel.IN_APP],
    },
    followUp: {
      enabled: true,
      hoursBefore: [24],
      channels: [NotificationChannel.IN_APP],
    },
    task: {
      enabled: true,
      hoursBefore: [24, 1],
      channels: [NotificationChannel.IN_APP],
    },
  });

  useEffect(() => {
    loadPreferences();
  }, [userId]);

  const loadPreferences = async (): Promise<void> => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/user/preferences');

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setPreferences(result.data);
        }
      }
    } catch (err) {
      console.error('加载提醒设置失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reminderPreferences: preferences }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '保存提醒设置失败');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '保存提醒设置失败';
      setError(errorMessage);
      console.error('保存提醒设置失败:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (): Promise<void> => {
    const defaultPreferences: ReminderPreferences = {
      courtSchedule: {
        enabled: true,
        hoursBefore: [24, 1],
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      },
      deadline: {
        enabled: true,
        daysBefore: [7, 3, 1],
        channels: [NotificationChannel.IN_APP],
      },
      followUp: {
        enabled: true,
        hoursBefore: [24],
        channels: [NotificationChannel.IN_APP],
      },
      task: {
        enabled: true,
        hoursBefore: [24, 1],
        channels: [NotificationChannel.IN_APP],
      },
    };

    setPreferences(defaultPreferences);
  };

  const handleToggleEnabled = (
    section: keyof ReminderPreferences,
    enabled: boolean
  ): void => {
    setPreferences(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        enabled,
      },
    }));
  };

  const handleToggleChannel = (
    section: keyof ReminderPreferences,
    channel: NotificationChannel
  ): void => {
    setPreferences(prev => {
      const currentChannels = prev[section].channels;
      const newChannels = currentChannels.includes(channel)
        ? currentChannels.filter(c => c !== channel)
        : [...currentChannels, channel];

      return {
        ...prev,
        [section]: {
          ...prev[section],
          channels: newChannels,
        },
      };
    });
  };

  const handleAddTimeBefore = (
    section: keyof ReminderPreferences,
    value: number
  ): void => {
    setPreferences(prev => {
      const sectionKey = section as keyof ReminderPreferences;
      const currentSection = prev[sectionKey];

      if ('hoursBefore' in currentSection) {
        const config = currentSection as unknown as
          | CourtScheduleReminderConfig
          | FollowUpReminderConfig;
        return {
          ...prev,
          [section]: {
            ...currentSection,
            hoursBefore: [...config.hoursBefore, value],
          },
        };
      } else if ('daysBefore' in currentSection) {
        const config = currentSection as unknown as DeadlineReminderConfig;
        return {
          ...prev,
          [section]: {
            ...currentSection,
            daysBefore: [...config.daysBefore, value],
          },
        };
      }
      return prev;
    });
  };

  const handleRemoveTimeBefore = (
    section: keyof ReminderPreferences,
    index: number
  ): void => {
    setPreferences(prev => {
      const sectionKey = section as keyof ReminderPreferences;
      const currentSection = prev[sectionKey];

      if ('hoursBefore' in currentSection) {
        const config = currentSection as unknown as
          | CourtScheduleReminderConfig
          | FollowUpReminderConfig;
        const newHours = [...config.hoursBefore];
        newHours.splice(index, 1);
        return {
          ...prev,
          [section]: {
            ...currentSection,
            hoursBefore: newHours,
          },
        };
      } else if ('daysBefore' in currentSection) {
        const config = currentSection as unknown as DeadlineReminderConfig;
        const newDays = [...config.daysBefore];
        newDays.splice(index, 1);
        return {
          ...prev,
          [section]: {
            ...currentSection,
            daysBefore: newDays,
          },
        };
      }
      return prev;
    });
  };

  const getHoursBefore = (section: keyof ReminderPreferences): number[] => {
    const currentSection = preferences[section];
    if ('hoursBefore' in currentSection) {
      const config = currentSection as unknown as
        | CourtScheduleReminderConfig
        | FollowUpReminderConfig;
      return config.hoursBefore;
    }
    return [];
  };

  const getDaysBefore = (section: keyof ReminderPreferences): number[] => {
    const currentSection = preferences[section];
    if ('daysBefore' in currentSection) {
      const config = currentSection as unknown as DeadlineReminderConfig;
      return config.daysBefore;
    }
    return [];
  };

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader>
          <CardTitle>提醒设置</CardTitle>
        </CardHeader>
        <CardContent className='space-y-6'>
          {loading ? (
            <div className='text-center py-8'>
              <div className='text-gray-500'>加载中...</div>
            </div>
          ) : (
            <>
              {error && (
                <div className='bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md'>
                  {error}
                </div>
              )}

              {success && (
                <div className='bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md'>
                  设置已保存
                </div>
              )}

              {/* 法庭日程提醒 */}
              <div className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <h3 className='text-lg font-semibold'>法庭日程提醒</h3>
                  <div className='flex items-center'>
                    <label className='relative inline-flex items-center cursor-pointer'>
                      <input
                        type='checkbox'
                        checked={preferences.courtSchedule.enabled}
                        onChange={e =>
                          handleToggleEnabled('courtSchedule', e.target.checked)
                        }
                        className='sr-only peer'
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>
                </div>

                {preferences.courtSchedule.enabled && (
                  <div className='space-y-3 pl-4'>
                    <div>
                      <label className='block text-sm font-medium text-gray-700 mb-1'>
                        通知渠道
                      </label>
                      <div className='flex flex-wrap gap-2'>
                        {Object.values(NotificationChannel).map(channel => {
                          const channelLabels: Record<
                            NotificationChannel,
                            string
                          > = {
                            IN_APP: '站内消息',
                            EMAIL: '邮件',
                            SMS: '短信',
                          };
                          const isSelected =
                            preferences.courtSchedule.channels.includes(
                              channel
                            );
                          return (
                            <button
                              key={channel}
                              type='button'
                              onClick={() =>
                                handleToggleChannel('courtSchedule', channel)
                              }
                              className={`px-3 py-2 rounded-md text-sm ${
                                isSelected
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-200 text-gray-700'
                              }`}
                            >
                              {channelLabels[channel]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className='block text-sm font-medium text-gray-700 mb-1'>
                        提前提醒时间
                      </label>
                      <div className='flex flex-wrap gap-2'>
                        {getHoursBefore('courtSchedule').map((hours, index) => (
                          <div
                            key={`hours-${index}`}
                            className='flex items-center bg-blue-100 text-blue-800 px-3 py-2 rounded-md text-sm'
                          >
                            <span>{hours}小时</span>
                            <button
                              type='button'
                              onClick={() =>
                                handleRemoveTimeBefore('courtSchedule', index)
                              }
                              className='ml-2 text-blue-600 hover:text-blue-800'
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          type='button'
                          onClick={() =>
                            handleAddTimeBefore('courtSchedule', 12)
                          }
                          className='px-3 py-2 border border-dashed border-blue-300 text-blue-600 rounded-md text-sm hover:bg-blue-50'
                        >
                          + 添加
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 截止日期提醒 */}
              <div className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <h3 className='text-lg font-semibold'>截止日期提醒</h3>
                  <div className='flex items-center'>
                    <label className='relative inline-flex items-center cursor-pointer'>
                      <input
                        type='checkbox'
                        checked={preferences.deadline.enabled}
                        onChange={e =>
                          handleToggleEnabled('deadline', e.target.checked)
                        }
                        className='sr-only peer'
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>
                </div>

                {preferences.deadline.enabled && (
                  <div className='space-y-3 pl-4'>
                    <div>
                      <label className='block text-sm font-medium text-gray-700 mb-1'>
                        通知渠道
                      </label>
                      <div className='flex flex-wrap gap-2'>
                        {Object.values(NotificationChannel).map(channel => {
                          const isSelected =
                            preferences.deadline.channels.includes(channel);
                          return (
                            <button
                              key={`deadline-${channel}`}
                              type='button'
                              onClick={() =>
                                handleToggleChannel('deadline', channel)
                              }
                              className={`px-3 py-2 rounded-md text-sm ${
                                isSelected
                                  ? 'bg-orange-600 text-white'
                                  : 'bg-gray-200 text-gray-700'
                              }`}
                            >
                              {channel === NotificationChannel.IN_APP
                                ? '站内消息'
                                : channel === NotificationChannel.EMAIL
                                  ? '邮件'
                                  : '短信'}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className='block text-sm font-medium text-gray-700 mb-1'>
                        提前提醒天数
                      </label>
                      <div className='flex flex-wrap gap-2'>
                        {getDaysBefore('deadline').map((days, index) => (
                          <div
                            key={`days-${index}`}
                            className='flex items-center bg-orange-100 text-orange-800 px-3 py-2 rounded-md text-sm'
                          >
                            <span>{days}天</span>
                            <button
                              type='button'
                              onClick={() =>
                                handleRemoveTimeBefore('deadline', index)
                              }
                              className='ml-2 text-orange-600 hover:text-orange-800'
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          type='button'
                          onClick={() => handleAddTimeBefore('deadline', 1)}
                          className='px-3 py-2 border border-dashed border-orange-300 text-orange-600 rounded-md text-sm hover:bg-orange-50'
                        >
                          + 添加
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 跟进提醒 */}
              <div className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <h3 className='text-lg font-semibold'>跟进提醒</h3>
                  <div className='flex items-center'>
                    <label className='relative inline-flex items-center cursor-pointer'>
                      <input
                        type='checkbox'
                        checked={preferences.followUp.enabled}
                        onChange={e =>
                          handleToggleEnabled('followUp', e.target.checked)
                        }
                        className='sr-only peer'
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>
                </div>

                {preferences.followUp.enabled && (
                  <div className='space-y-3 pl-4'>
                    <div>
                      <label className='block text-sm font-medium text-gray-700 mb-1'>
                        通知渠道
                      </label>
                      <div className='flex flex-wrap gap-2'>
                        {Object.values(NotificationChannel).map(channel => {
                          const isSelected =
                            preferences.followUp.channels.includes(channel);
                          return (
                            <button
                              key={`followup-${channel}`}
                              type='button'
                              onClick={() =>
                                handleToggleChannel('followUp', channel)
                              }
                              className={`px-3 py-2 rounded-md text-sm ${
                                isSelected
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-gray-200 text-gray-700'
                              }`}
                            >
                              {channel === NotificationChannel.IN_APP
                                ? '站内消息'
                                : channel === NotificationChannel.EMAIL
                                  ? '邮件'
                                  : '短信'}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className='block text-sm font-medium text-gray-700 mb-1'>
                        提前提醒小时
                      </label>
                      <div className='flex flex-wrap gap-2'>
                        {getHoursBefore('followUp').map((hours, index) => (
                          <div
                            key={`followup-hours-${index}`}
                            className='flex items-center bg-purple-100 text-purple-800 px-3 py-2 rounded-md text-sm'
                          >
                            <span>{hours}小时</span>
                            <button
                              type='button'
                              onClick={() =>
                                handleRemoveTimeBefore('followUp', index)
                              }
                              className='ml-2 text-purple-600 hover:text-purple-800'
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          type='button'
                          onClick={() => handleAddTimeBefore('followUp', 12)}
                          className='px-3 py-2 border border-dashed border-purple-300 text-purple-600 rounded-md text-sm hover:bg-purple-50'
                        >
                          + 添加
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 操作按钮 */}
              <div className='flex items-center justify-end space-x-3 pt-4 border-t'>
                <Button
                  variant='outline'
                  onClick={handleReset}
                  disabled={saving}
                >
                  重置为默认
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? '保存中...' : '保存设置'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
