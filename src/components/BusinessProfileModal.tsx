/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Settings, Check, Trash2, Shield, MapPin, Percent, Calendar, Clock, UserCheck } from 'lucide-react';

export interface BusinessProfile {
  role: string;
  maxPenaltyPercent: string;
  maxPaymentDays: string;
  minNoticeDays: string;
  disputeCity: string;
  customRules: string;
}

export const ROLE_OPTIONS = [
  'арендатор',
  'арендодатель',
  'заказчик',
  'исполнитель',
  'покупатель',
  'поставщик',
] as const;

interface BusinessProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProfile: BusinessProfile;
  onSave: (profile: BusinessProfile) => void;
  onClear: () => void;
}

export const BusinessProfileModal: React.FC<BusinessProfileModalProps> = ({
  isOpen,
  onClose,
  initialProfile,
  onSave,
  onClear,
}) => {
  const [role, setRole] = useState(initialProfile.role || '');
  const [maxPenaltyPercent, setMaxPenaltyPercent] = useState(initialProfile.maxPenaltyPercent || '');
  const [maxPaymentDays, setMaxPaymentDays] = useState(initialProfile.maxPaymentDays || '');
  const [minNoticeDays, setMinNoticeDays] = useState(initialProfile.minNoticeDays || '');
  const [disputeCity, setDisputeCity] = useState(initialProfile.disputeCity || '');
  const [customRules, setCustomRules] = useState(initialProfile.customRules || '');
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRole(initialProfile.role || '');
      setMaxPenaltyPercent(initialProfile.maxPenaltyPercent || '');
      setMaxPaymentDays(initialProfile.maxPaymentDays || '');
      setMinNoticeDays(initialProfile.minNoticeDays || '');
      setDisputeCity(initialProfile.disputeCity || '');
      setCustomRules(initialProfile.customRules || '');
      setSavedNotice(false);
    }
  }, [isOpen, initialProfile]);

  if (!isOpen) return null;

  const handleSave = () => {
    const updated: BusinessProfile = {
      role: role.trim(),
      maxPenaltyPercent: maxPenaltyPercent.trim(),
      maxPaymentDays: maxPaymentDays.trim(),
      minNoticeDays: minNoticeDays.trim(),
      disputeCity: disputeCity.trim(),
      customRules: customRules.trim().slice(0, 300),
    };
    onSave(updated);
    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 400);
  };

  const handleClear = () => {
    setRole('');
    setMaxPenaltyPercent('');
    setMaxPaymentDays('');
    setMinNoticeDays('');
    setDisputeCity('');
    setCustomRules('');
    onClear();
  };

  const charCount = customRules.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-[#0e141a] border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative max-h-[92vh] flex flex-col space-y-4 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Мои правила</span>
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Профиль бизнеса
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Критерии для персональной проверки договоров ИИ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 py-1 text-xs">
          {/* 1. Моя роль */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Моя роль</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {ROLE_OPTIONS.map((opt) => {
                const isSelected = role === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setRole(isSelected ? '' : opt)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium text-center transition-all border ${
                      isSelected
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                        : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Максимальная допустимая неустойка в день (%) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-emerald-400" />
              <span>Максимальная допустимая неустойка в день (%)</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={maxPenaltyPercent}
                onChange={(e) => setMaxPenaltyPercent(e.target.value)}
                placeholder="например: 0.1"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#080c0f] border border-slate-800 focus:border-emerald-500/60 focus:outline-none text-slate-200 text-xs font-mono placeholder:text-slate-600"
              />
              <span className="absolute right-3.5 top-2.5 text-xs text-slate-500 font-mono">% / день</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Обычная рыночная практика в Казахстане: 0.05% – 0.1% в день.
            </p>
          </div>

          {/* 3. Максимальный срок оплаты (дней) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Максимальный срок оплаты (дней)</span>
            </label>
            <input
              type="number"
              min="1"
              max="365"
              value={maxPaymentDays}
              onChange={(e) => setMaxPaymentDays(e.target.value)}
              placeholder="например: 5 или 10"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#080c0f] border border-slate-800 focus:border-emerald-500/60 focus:outline-none text-slate-200 text-xs font-mono placeholder:text-slate-600"
            />
          </div>

          {/* 4. Минимальный срок уведомления об отказе от договора (дней) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>Минимальный срок уведомления об отказе от договора (дней)</span>
            </label>
            <input
              type="number"
              min="1"
              max="365"
              value={minNoticeDays}
              onChange={(e) => setMinNoticeDays(e.target.value)}
              placeholder="например: 30"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#080c0f] border border-slate-800 focus:border-emerald-500/60 focus:outline-none text-slate-200 text-xs font-mono placeholder:text-slate-600"
            />
          </div>

          {/* 5. Город для рассмотрения споров */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>Город для рассмотрения споров</span>
            </label>
            <input
              type="text"
              value={disputeCity}
              onChange={(e) => setDisputeCity(e.target.value)}
              placeholder="например: Алматы или Астана"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#080c0f] border border-slate-800 focus:border-emerald-500/60 focus:outline-none text-slate-200 text-xs placeholder:text-slate-600"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Предупредит, если в договоре указан другой регион или удалённый третейский суд.
            </p>
          </div>

          {/* 6. Мои дополнительные правила (до 300 символов) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Мои дополнительные правила</span>
              </label>
              <span className={`text-[10px] font-mono ${charCount > 280 ? 'text-amber-400 font-semibold' : 'text-slate-500'}`}>
                {charCount} / 300
              </span>
            </div>
            <textarea
              maxLength={300}
              rows={3}
              value={customRules}
              onChange={(e) => setCustomRules(e.target.value)}
              placeholder="например: Без штрафов за досрочное расторжение, акт приёмки подписывается не менее 5 рабочих дней"
              className="w-full p-3 rounded-xl bg-[#080c0f] border border-slate-800 focus:border-emerald-500/60 focus:outline-none text-slate-200 text-xs placeholder:text-slate-600 resize-none leading-relaxed"
            />
          </div>
        </div>

        {/* Footer & Actions */}
        <div className="pt-3 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleClear}
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-rose-950/30 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/30 text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Очистить</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                {savedNotice ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Сохранено!</span>
                  </>
                ) : (
                  <span>Сохранить</span>
                )}
              </button>
            </div>
          </div>

          {/* Privacy Note Required by 2.2 */}
          <div className="text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5 pt-1">
            <Shield className="w-3.5 h-3.5 text-emerald-400/80 shrink-0" />
            <span>Правила хранятся только на вашем устройстве</span>
          </div>
        </div>
      </div>
    </div>
  );
};
