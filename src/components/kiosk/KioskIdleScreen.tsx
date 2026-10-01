/**
 * 밀양시립 스마트도서관 안내 (첫 화면)
 *
 * [기능]
 * - 이용안내/대출절차/반납절차/문의처 (전체 CMS 관리, 하드코딩 없음)
 * - 단계별 삽화는 관리자 미디어 등록 후 URL 지정 (미지정 시 번호 뱃지)
 * - 시작하기 → idle 포털
 */

'use client';

import { useAppStore } from '@/stores/useAppStore';
import { useKioskSpeak } from '@/hooks/useKioskSpeak';
import { CmsImage, useScreenTheme } from '@/components/kiosk/CmsMedia';
import KioskA11yBar from '@/components/kiosk/KioskA11yBar';
import { ChevronRight, Phone } from 'lucide-react';

const LOAN_STEPS = [1, 2, 3, 4, 5, 6, 7];
const RETURN_STEPS = [1, 2, 3, 4];

export default function KioskIdleScreen() {
  const cmsContent = useAppStore((s) => s.cmsContent);
  const setScreen = useAppStore((s) => s.setScreen);
  const theme = useScreenTheme('miryang-main', '#f4f1ea');

  /** CMS 텍스트 조회 (없으면 기본값) */
  const t = (key: string, fallback: string) => cmsContent[key] || fallback;
  /** CMS 이미지 URL (안전하지 않으면 빈 값) */
  const img = (key: string) => {
    const v = cmsContent[key] || '';
    return v.startsWith('/') && !v.startsWith('//') || v.startsWith('https://') ? v : '';
  };

  useKioskSpeak('밀양시립 스마트도서관 안내입니다. 내용을 확인하고 시작하기를 눌러주세요.');

  const loanSteps = LOAN_STEPS.map((n) => ({
    label: t(`miryang.loan_step_${n}`, `단계${n}`),
    image: img(`miryang.loan_img_${n}`),
  }));
  const returnSteps = RETURN_STEPS.map((n) => ({
    label: t(`miryang.return_step_${n}`, `단계${n}`),
    image: img(`miryang.return_img_${n}`),
  }));

  // 안내 이미지가 있으면 이미지 자체가 전체 안내이므로 텍스트 섹션 생략
  const hasHero = !!img('miryang.hero_image');

  return (
    <div className="kiosk-screen flex flex-col" style={theme.style}>
      <main className="flex-1 overflow-y-auto kiosk-scroll">
        {/* 상단 안내 이미지 */}
        {img('miryang.hero_image') ? (
          <img src={img('miryang.hero_image')} alt="스마트도서관 안내" className="w-full h-auto block" />
        ) : (
          <div className="px-6 pt-10 pb-6 text-center bg-gradient-to-b from-amber-50 to-orange-50">
            <p className="text-lg font-bold text-slate-800">{t('miryang.quote', '"상상이 자라는 공간"')}</p>
            <p className="text-3xl font-black text-slate-800 mt-2 tracking-wide">{t('miryang.title', '스마트 도서관')}</p>
          </div>
        )}

        {/* 리본 제목 이하 텍스트 섹션 (안내 이미지 없을 때만) */}
        {!hasHero && (
          <>
        {/* 리본 제목 */}
        <div className="mx-6 mt-4 rounded-lg bg-[#0e5a6d] py-2.5 text-center">
          <p className="text-white text-lg font-bold tracking-[0.3em]">{t('miryang.ribbon', '스마트도서관 이용방법')}</p>
        </div>

        {/* 이용안내 */}
        <section className="mx-4 mt-4 rounded-xl bg-slate-100/80 p-4" aria-label={t('miryang.info_title', '이용안내')}>
          <p className="text-base font-bold text-slate-700 mb-2">ⓘ {t('miryang.info_title', '이용안내')}</p>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex gap-3 py-1 text-sm">
              <span className="font-bold text-slate-800 shrink-0 w-16">▪ {t(`miryang.info_${n}_label`, '')}</span>
              <span className="text-slate-600">{t(`miryang.info_${n}_value`, '')}</span>
            </div>
          ))}
        </section>

        {/* 대출 절차 */}
        <section className="mx-4 mt-4 rounded-xl bg-slate-100/80 p-4" aria-label={t('miryang.loan_title', '대출')}>
          <p className="text-base font-bold text-slate-700 mb-3">📖 {t('miryang.loan_title', '대출')}</p>
          <div className="flex items-center gap-1 overflow-x-auto kiosk-scroll pb-1">
            {loanSteps.map((s, i) => (
              <div key={i} className="flex items-center gap-1 shrink-0">
                <div className="w-16 text-center">
                  {s.image ? (
                    <img src={s.image} alt={s.label} className="w-16 h-20 object-cover rounded-md border border-slate-200" loading="lazy" />
                  ) : (
                    <div className="w-16 h-20 rounded-md bg-sky-100 border border-sky-200 flex items-center justify-center">
                      <span className="text-xl font-black text-sky-600">{i + 1}</span>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-600 mt-1 leading-tight">{s.label}</p>
                </div>
                {i < loanSteps.length - 1 && <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
              </div>
            ))}
          </div>
        </section>

        {/* 반납 절차 */}
        <section className="mx-4 mt-4 rounded-xl bg-slate-100/80 p-4" aria-label={t('miryang.return_title', '반납')}>
          <p className="text-base font-bold text-slate-700 mb-3">📥 {t('miryang.return_title', '반납')}</p>
          <div className="flex items-center gap-1 overflow-x-auto kiosk-scroll pb-1">
            {returnSteps.map((s, i) => (
              <div key={i} className="flex items-center gap-1 shrink-0">
                <div className="w-16 text-center">
                  {s.image ? (
                    <img src={s.image} alt={s.label} className="w-16 h-20 object-cover rounded-md border border-slate-200" loading="lazy" />
                  ) : (
                    <div className="w-16 h-20 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                      <span className="text-xl font-black text-emerald-600">{i + 1}</span>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-600 mt-1 leading-tight">{s.label}</p>
                </div>
                {i < returnSteps.length - 1 && <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
              </div>
            ))}
          </div>
        </section>

        {/* 로고 + 문의처 */}
        <div className="px-6 mt-5 flex flex-col items-center">
          <CmsImage contentKey="miryang.logo_image" alt="밀양시 로고" imgClassName="h-12 object-contain" />
          <div className="w-full mt-3 rounded-lg border-2 border-[#0e5a6d] overflow-hidden flex">
            <div className="bg-[#0e5a6d] text-white text-sm font-bold px-3 py-2 flex items-center gap-1 shrink-0">
              <Phone className="w-4 h-4" />
              문의처
            </div>
            <div className="px-3 py-2 text-xs text-slate-700 leading-relaxed bg-white flex-1">
              <p>{t('miryang.contact_1', '')}</p>
              <p>{t('miryang.contact_2', '')}</p>
            </div>
          </div>
        </div>
        <div className="h-4" />
          </>
        )}
      </main>

      {/* 접근성 + 시작 (화면 하단 고정) */}
      <footer className="kiosk-sticky-footer px-5 pb-5 pt-2 shrink-0 bg-white/95 border-t border-slate-200">
        <div className="flex justify-center py-2">
          <KioskA11yBar dark={false} />
        </div>
        <button
          onClick={() => setScreen('portal')}
          className="w-full h-14 rounded-2xl bg-[#0e5a6d] text-white text-lg font-bold shadow-lg"
          aria-label="도서관 이용 시작하기"
        >
          {t('miryang.start_button', '시작하기')}
        </button>
      </footer>
    </div>
  );
}
