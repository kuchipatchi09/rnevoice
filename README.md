# Lissajous Signal Lab (리사주 신호 분석 시스템)

> **과학영재 R&E 연구 과제**  
> **"리사주 위상차 매칭 및 음성 스펙트럼 변수 분석을 통한 보안 알고리즘 구현"**  
> 실시간 오디오 신호 처리, 리사주 위상차 측정, 가중치 기반 신호 매칭 및 음성 STFT 분석 웹 애플리케이션

---

## 1. 프로젝트 개요

본 시스템은 마이크 및 USB 오디오 인터페이스(Stereo Audio Interface)를 통해 유입되는 음향 신호를 Web Audio API와 실시간 DSP(디지털 신호 처리) 알고리즘으로 분석하는 **실제 실험용 과학 연구 대시보드**입니다.

### 핵심 연구 질문
> *"기준 신호와 입력 신호 사이의 진동수(\(f\)), 진폭(\(A\)), 위상차(\(\Delta\phi\))를 정량화하고, 변수별 가중치를 적용한 오차 함수 \(D\)가 순음 및 음성 신호를 신뢰성 있게 구분 및 인증할 수 있는가?"*

---

## 2. 주요 기능 및 화면 구성

### 탭 1: Pure Tone Analysis (순음 분석 및 인증)
- **Time-Domain Waveform**: 정규화된 PCM 파형 오실로스코프 (Zero-crossing trigger 기반 안정적 디스플레이, CH1/CH2 개별 렌더링).
- **Frequency Spectrum (FFT)**: 2차 포물선 보간(Quadratic Peak Interpolation)을 적용한 최고 정밀도 주파수 피크 검출.
- **Lissajous Figure (XY Plot)**: 좌/우 채널 실시간 위상 궤적 렌더링. 단일 마이크 환경에서는 시뮬레이션 기준파 모드(`SIMULATED REFERENCE`), 2채널 인터페이스 연결 시 실제 측정 모드(`STEREO MEASUREMENT`)로 자동 전환.
- **가중치 기반 판별 엔진**:
  \[
  D_f = \frac{|f - f_0|}{T_f}, \quad D_A = \frac{|A - A_0|}{T_A}, \quad D_\phi = \frac{\text{circularError}(\phi, \phi_0)}{T_\phi}
  \]
  \[
  D = w_f D_f + w_A D_A + w_\phi D_\phi \quad (\text{조건: } w_f + w_A + w_\phi = 1)
  \]
  - \(D < D_{th}\) 일 때 **PASS**, \(D \ge D_{th}\) 일 때 **FAIL** 판정.
- **3초 실시간 캘리브레이션 (Calibration)**: 3초간 입력 신호의 평균 및 표준편차(\(\mu \pm \sigma\))를 계산하여 기준 프로파일로 등록.
- **하드웨어 프리 테스트 신호 발생기 (Synthetic Generator)**: 마이크가 없는 환경에서도 진동수, 진폭, 위상, 노이즈를 제어하여 동일한 DSP 파이프라인 검증 가능.

### 탭 2: Voice Spectrum (음성 스펙트럼 및 STFT)
- 최대 15초 음성 및 모음 녹음/재생.
- **STFT Spectrogram**: 2048 FFT, Hann Window, 512 Hop Size 기반 시간-주파수 2D 컬러맵(Magma Palette).
- **음향 특징 자동 추출**:
  - 발화 길이 (Duration)
  - 평균 및 피크 RMS 진폭
  - 자기상관(Autocorrelation F0) 기반 피치 추정
  - 스펙트럼 중심 (Spectral Centroid)
  - 스펙트럼 롤오프 (Spectral Rolloff 85%)
  - 스펙트럼 대역폭 (Spectral Bandwidth)
  - 영교차율 (Zero Crossing Rate, ZCR)
- **다변수 특징 거리 (Modular Multi-Feature Distance)**: 기준 템플릿과의 \(D_{\text{voice}}\) 비교 구조 제공.

### 탭 3: Lissajous Simulator (독립 수학 시뮬레이터)
- \(x(t) = A_x \sin(2\pi f_x t)\), \(y(t) = A_y \sin(2\pi f_y t + \phi)\) 수식 기반 실시간 위상 변화 관찰.
- 1:1, 1:2, 2:3, 3:4 비율 및 0°, 45°, 90°, 180° 프리셋 지원.

### 탭 4: Experiment Records (실험 데이터 로그 및 통계)
- Trial 번호, 측정값, 오차, 가중치, 점수 \(D\), PASS/FAIL 이력 테이블.
- 통계 분석: 전체 시행 횟수, PASS 수락률, 점수/진동수/위상 오차의 Mean \(\pm\) SD.
- 점수 \(D\) 빈도 히스토그램.
- **RFC-4180 표준 CSV 다운로드** 지원.

### 탭 5: Settings (하드웨어 및 DSP 환경 설정)
- 오디오 입력 장치 선택 (`navigator.mediaDevices.enumerateDevices`).
- FFT 버퍼 크기 (1024 / 2048 / 4096), 스무딩 상수, 이동평균 윈도우 조절.

---

## 3. 설치 및 로컬 실행 방법

### 요구 사항
- **Node.js**: v18.0.0 이상 (v20+ 권장)
- **최신 Google Chrome 브라우저** (Web Audio API 최적화)

### 실행 단계
```bash
# 1. 의존성 패키지 설치
npm install

# 2. 로컬 개발 서버 실행
npm run dev
```

브라우저에서 `http://localhost:5173`으로 접속합니다.

---

## 4. 마이크 권한 및 스테레오 오디오 인터페이스 설정

1. 브라우저 접속 시 상단에 표시되는 **"마이크 사용 권한"** 요청에서 **[허용]**을 선택합니다.
2. 2채널 오디오 인터페이스(예: Focusrite Scarlett 2i2, Behringer UMC202HD 등)를 연결한 경우:
   - **CH1 (Left)**: 신호발생기 또는 기준 음향 신호 연결
   - **CH2 (Right)**: 센서 또는 피측정 음향 신호 연결
   - 시스템이 자동으로 2채널을 감지하여 **STEREO MEASUREMENT** 모드로 작동합니다.
3. 내장 단일 마이크인 경우:
   - 시스템이 자동으로 **SIMULATED REFERENCE** 모드로 작동하여 가상 기준파와의 위상차 및 리사주 도형을 안전하게 표시합니다.

---

## 5. 소스 코드 모듈 구조

```
src/
├── audio/                      # 오디오 캡처 및 DSP 신호처리 코어
│   ├── AudioInput.ts           # Web Audio Context, 장치 탐색, 합성 신호 생성
│   ├── FFTAnalyzer.ts          # FFT 크기 계산, Quadratic Peak Interpolation
│   ├── PhaseAnalyzer.ts        # 복소수 DFT 기반 위상각 계산, 원형 위상차
│   ├── PitchAnalyzer.ts        # 자기상관(Autocorrelation) F0 피치 검출
│   ├── STFTAnalyzer.ts         # 단시간 퓨리에 변환 및 스펙트럼 특징량 추출
│   └── EnvelopeAnalyzer.ts     # 슬라이딩 RMS 진폭 포락선 추출
│
├── algorithms/                 # 과학 판별 및 보안 평가 알고리즘
│   ├── PureToneClassifier.ts   # 정규화 오차(Df, DA, Dphi) 및 PASS/FAIL 판정
│   ├── WeightCalculator.ts     # 가중치 자동 정규화 및 기여도 분해
│   └── VoiceFeatureExtractor.ts# 음성 특징량 추출 및 다변수 거리 D_voice
│
├── visualization/              # 고성능 Canvas 렌더러
│   ├── WaveformRenderer.ts     # 오실로스코프 파형 렌더러 (트리거링 적용)
│   ├── SpectrumRenderer.ts     # 주파수 스펙트럼 및 피크 마커 핀
│   ├── LissajousRenderer.ts    # 리사주 XY 궤적 및 모드 뱃지
│   ├── SpectrogramRenderer.ts  # STFT 2D 시간-주파수 컬러맵
│   └── HistogramRenderer.ts    # 오차 점수 D 분포 히스토그램
│
├── storage/                    # 데이터 영속화 및 내보내기
│   ├── ExperimentStorage.ts    # LocalStorage 기반 실험 데이터/프로파일 저장
│   └── CSVExporter.ts          # RFC-4180 표준 실험 결과 CSV 내보내기
│
├── ui/                         # 연구 대시보드 UI 컴포넌트
│   ├── Header.ts               # 상단 시스템 상태 바 (품질, 샘플링 레이트)
│   ├── PureToneTab.ts          # 순음 분석 및 실시간 판별 뷰
│   ├── VoiceSpectrumTab.ts     # 음성 녹음 및 STFT 분석 뷰
│   ├── LissajousSimulatorTab.ts# 수학적 리사주 시뮬레이터 뷰
│   ├── RecordsTab.ts           # 실험 기록 및 통계 집계 뷰
│   └── SettingsTab.ts          # 하드웨어 및 DSP 설정 뷰
│
├── types/                      # TypeScript 인터페이스 정의
│   └── index.ts
│
├── style.css                   # 연구 장비 테마 CSS (Tailwind)
└── main.ts                     # 애플리케이션 진입점 및 렌더 루프
```

---

## 6. 연구 실험 시 주의사항

1. **에코/노이즈 억제 비활성화**: 본 시스템은 순수 물리 음향 측정을 위해 브라우저의 `echoCancellation`, `noiseSuppression`, `autoGainControl`을 강제로 `false`로 설정합니다.
2. **신호 품질 뱃지 확인**:
   - `LOW LEVEL`: 마이크 게인을 높이거나 음원을 가까이 배치하십시오.
   - `CLIPPING`: 입력 신호가 1.0을 초과하므로 오디오 인터페이스 게인을 낮추십시오.
   - `UNSTABLE`: 주파수 변동이 크므로 주변 환경 소음을 차단하십시오.
3. **위상차 원형 거리(Circular Distance)**: 위상은 0°와 360°가 동일하므로 \(\min(|\phi - \phi_0|, 360^\circ - |\phi - \phi_0|)\) 수식으로 계산됩니다.
