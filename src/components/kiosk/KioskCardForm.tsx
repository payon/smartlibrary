/**
 * 도서증 발급 개인정보 입력 폼 화면
 *
 * [기능]
 * - 이름, 생년월일, 전화번호, 주소 입력 (CMS 관리)
 * - 카드 종류 표시 (모바일/실물)
 * - 폼 유효성 검증 및 에러 메시지
 * - 제출 시 API 호출 후 화면 전환
 *
 * [디자인]
 * - 다크 네이비 배경 (#0b1120)
 * - 대형 터치 친화적 입력 필드
 * - Framer Motion 진입 애니메이션
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { ArrowLeft, User, CalendarDays, Phone, MapPin, CreditCard, Send } from 'lucide-react';
import { CmsText } from '@/components/kiosk/CmsText';

/** 폼 에러 타입 */
interface FormErrors {
  applicantName?: string;
  birthDate?: string;
  phone?: string;
}

export default function KioskCardForm() {
  const { cardApplication, setCardApplication, setCardResult, setScreen } = useAppStore();

  const [name, setName] = useState(cardApplication?.applicantName ?? '');
  const [birthDate, setBirthDate] = useState(cardApplication?.birthDate ?? '');
  const [phone, setPhone] = useState(cardApplication?.phone ?? '');
  const [address, setAddress] = useState(cardApplication?.address ?? '');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const cardType = cardApplication?.cardType ?? 'mobile';
  const isMobile = cardType === 'mobile';

  /** 뒤로가기 */
  const handleBack = () => {
    setScreen('card-apply');
  };

  /** 폼 유효성 검증 */
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.applicantName = '이름을 입력해주세요';
    } else if (name.trim().length < 2) {
      newErrors.applicantName = '이름은 2자 이상이어야 합니다';
    }

    if (!birthDate.trim()) {
      newErrors.birthDate = '생년월일을 입력해주세요';
    } else if (!/^\d{8}$/.test(birthDate.replace(/\s/g, ''))) {
      newErrors.birthDate = '생년월일 8자리 숫자로 입력해주세요';
    }

    if (!phone.trim()) {
      newErrors.phone = '전화번호를 입력해주세요';
    } else if (!/^\d{10,11}$/.test(phone.replace(/[^0-9]/g, ''))) {
      newErrors.phone = '올바른 전화번호를 입력해주세요';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /** 폼 제출 */
  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);

    const applicationData = {
      applicantName: name.trim(),
      birthDate: birthDate.replace(/\s/g, ''),
      phone: phone.replace(/[^0-9]/g, ''),
      address: address.trim(),
      cardType,
    };

    // 스토어에 저장
    setCardApplication(applicationData);

    try {
      // API 호출
      const res = await fetch('/api/card-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applicationData),
      });

      if (res.ok) {
        const data = await res.json();
        // API 응답에서 PIN 및 카드번호 저장
        if (data.user) {
          setCardResult({
            cardId: data.card?.id || null,
            cardNumber: data.card?.cardNumber || data.user.cardNumber || null,
            pin: data.user.pin || null,
            userId: data.user.id || null,
          });
        } else if (data.card) {
          setCardResult({
            cardId: data.card.id || null,
            cardNumber: data.card.cardNumber || null,
            pin: null,
            userId: null,
          });
        }
      } else {
        const data = await res.json().catch(() => ({}));
        console.error('카드 신청 오류:', data);
        setCardResult(null);
      }
    } catch (err) {
      console.error('카드 신청 네트워크 오류:', err);
      setCardResult(null);
    }

    // 화면 전환: 모바일은 완료, 실물은 대기
    if (isMobile) {
      setScreen('card-complete');
    } else {
      setScreen('card-pending');
    }

    setSubmitting(false);
  };

  /** 생년월일 포맷팅 (자동 하이픈) */
  const handleBirthDateChange = (value: string) => {
    const digits = value.replace(/[^0-9]/g, '').slice(0, 8);
    setBirthDate(digits);
  };

  /** 전화번호 포맷팅 (자동 하이픈) */
  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/[^0-9]/g, '').slice(0, 11);
    setPhone(digits);
  };

  return (
    <div
      className="flex flex-col h-screen"
      style={{ background: '#0b1120' }}
    >
      {/* 상단 헤더 */}
      <header className="flex items-center px-6 pt-8 pb-4">
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors min-h-[48px] min-w-[48px]"
          aria-label="뒤로가기"
        >
          <ArrowLeft className="w-6 h-6" />
          <span className="text-sm">이전</span>
        </motion.button>
      </header>

      {/* 타이틀 */}
      <div className="text-center pb-4 px-6">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-2xl font-bold text-white tracking-wider"
        >
          <CmsText contentKey="cardform.title" fallback="개인정보 입력" />
        </motion.h1>
      </div>

      {/* 카드 종류 표시 */}
      <div className="px-8 mb-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex items-center gap-2 justify-center"
        >
          <CreditCard className="w-4 h-4 text-amber-400" />
          <span className={`text-sm font-medium ${isMobile ? 'text-sky-400' : 'text-amber-400'}`}>
            {isMobile ? '모바일 도서증' : '실물 도서증'}
          </span>
        </motion.div>
      </div>

      {/* 입력 폼 */}
      <main className="flex-1 overflow-y-auto px-8 space-y-5">
        {/* 이름 */}
        <motion.div
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          <label className="flex items-center gap-2 text-slate-400 text-sm mb-2">
            <User className="w-4 h-4" />
            <CmsText contentKey="cardform.name_label" fallback="이름" />
            <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="홍길동"
            className="w-full rounded-xl px-5 py-4 text-lg text-white placeholder-slate-600 outline-none transition-all duration-200 focus:ring-2 focus:ring-sky-500/40"
            style={{
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(148, 163, 184, 0.15)',
              minHeight: '56px',
            }}
          />
          {errors.applicantName && (
            <p className="text-red-400 text-xs mt-1.5 ml-1">{errors.applicantName}</p>
          )}
        </motion.div>

        {/* 생년월일 */}
        <motion.div
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
        >
          <label className="flex items-center gap-2 text-slate-400 text-sm mb-2">
            <CalendarDays className="w-4 h-4" />
            <CmsText contentKey="cardform.birthdate_label" fallback="생년월일" />
            <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={birthDate}
            onChange={(e) => handleBirthDateChange(e.target.value)}
            placeholder="19900101"
            maxLength={8}
            className="w-full rounded-xl px-5 py-4 text-lg text-white placeholder-slate-600 outline-none transition-all duration-200 focus:ring-2 focus:ring-sky-500/40"
            style={{
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(148, 163, 184, 0.15)',
              minHeight: '56px',
            }}
          />
          {errors.birthDate && (
            <p className="text-red-400 text-xs mt-1.5 ml-1">{errors.birthDate}</p>
          )}
        </motion.div>

        {/* 전화번호 */}
        <motion.div
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.3 }}
        >
          <label className="flex items-center gap-2 text-slate-400 text-sm mb-2">
            <Phone className="w-4 h-4" />
            <CmsText contentKey="cardform.phone_label" fallback="전화번호" />
            <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            inputMode="tel"
            value={phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder="01012345678"
            maxLength={11}
            className="w-full rounded-xl px-5 py-4 text-lg text-white placeholder-slate-600 outline-none transition-all duration-200 focus:ring-2 focus:ring-sky-500/40"
            style={{
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(148, 163, 184, 0.15)',
              minHeight: '56px',
            }}
          />
          {errors.phone && (
            <p className="text-red-400 text-xs mt-1.5 ml-1">{errors.phone}</p>
          )}
        </motion.div>

        {/* 주소 */}
        <motion.div
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.4 }}
        >
          <label className="flex items-center gap-2 text-slate-400 text-sm mb-2">
            <MapPin className="w-4 h-4" />
            <CmsText contentKey="cardform.address_label" fallback="주소" />
            <span className="text-slate-600 text-xs">(선택)</span>
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="서울시 강남구 대치동"
            className="w-full rounded-xl px-5 py-4 text-lg text-white placeholder-slate-600 outline-none transition-all duration-200 focus:ring-2 focus:ring-sky-500/40"
            style={{
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(148, 163, 184, 0.15)',
              minHeight: '56px',
            }}
          />
        </motion.div>
      </main>

      {/* 제출 버튼 */}
      <footer className="pb-8 px-8 pt-4">
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full max-w-md mx-auto rounded-2xl flex items-center justify-center gap-3 cursor-pointer transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            minHeight: '64px',
            background: isMobile
              ? 'linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%)'
              : 'linear-gradient(135deg, #4a3620 0%, #3a2a15 100%)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
            border: isMobile
              ? '1px solid rgba(56, 189, 248, 0.2)'
              : '1px solid rgba(251, 191, 36, 0.2)',
          }}
        >
          <Send className="w-5 h-5 text-white" strokeWidth={1.5} />
          <span className="text-lg font-bold text-white tracking-wider">
            {submitting
              ? '처리 중...'
              : <CmsText contentKey="cardform.submit_button_text" fallback="신청하기" />
            }
          </span>
        </motion.button>
      </footer>
    </div>
  );
}
