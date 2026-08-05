/**
 * TTS (Text-to-Speech) 모듈
 *
 * [역할]
 * - 시니어 사용자를 위한 음성 안내 기능
 * - Web Speech API 기반 한국어 TTS
 *
 * [보안]
 * - 클라이언트 전용 모듈 (서버 사이드 실행 방지)
 * - 사용자 음성 데이터는 처리하지 않음 (출력만)
 */

'use client';

/** TTS 활성화 상태 (기본값: 활성) */
let ttsEnabled = true;

/**
 * TTS 활성화/비활성화 설정
 * @param enabled - 활성화 여부
 */
export function setTtsEnabled(enabled: boolean) {
  ttsEnabled = enabled;
}

/**
 * TTS 현재 활성화 상태 조회
 * @returns 활성화 여부
 */
export function isTtsEnabled() {
  return ttsEnabled;
}

/**
 * 텍스트 음성 출력 함수
 * 한국어 음성을 우선 선택하여 텍스트를 읽어줍니다.
 *
 * @param text - 읽을 텍스트
 * @param onEnd - 읽기 완료 후 콜백
 */
export function speak(text: string, onEnd?: () => void) {
  // 서버 사이드 실행 방지
  if (typeof window === 'undefined') return;

  // TTS 비활성화 시 콜백만 실행
  if (!ttsEnabled) {
    onEnd?.();
    return;
  }

  // 기존 음성 출력 취소
  window.speechSynthesis.cancel();

  // 음성 출력 객체 생성
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ko-KR';
  utterance.rate = 0.85; // 시니어 친화적 약간 느린 속도
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // 한국어 음성 우선 선택
  const voices = window.speechSynthesis.getVoices();
  const koreanVoice = voices.find(v => v.lang.startsWith('ko'));
  if (koreanVoice) {
    utterance.voice = koreanVoice;
  }

  // 읽기 완료 콜백 설정
  if (onEnd) {
    utterance.onend = onEnd;
  }

  // 음성 출력 시작
  window.speechSynthesis.speak(utterance);
}

/**
 * 진행 중인 음성 출력 중지
 */
export function stopSpeaking() {
  if (typeof window === 'undefined') return;
  window.speechSynthesis.cancel();
}

// ========================================================================
// 음성 엔진 사전 로드
// ========================================================================
if (typeof window !== 'undefined') {
  // 초기 음성 목록 로드
  window.speechSynthesis?.getVoices();
  // 음성 목록 변경 이벤트 감지 (비동기 로딩 대응)
  window.speechSynthesis?.addEventListener('voiceschanged', () => {
    window.speechSynthesis.getVoices();
  });
}
