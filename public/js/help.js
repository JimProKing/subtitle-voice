export const HELP = {
  start: '카메라를 켠 다음, 극장 화면 아래 자막이 노란 칸 안에 들어오게 휴대폰을 고정하세요. 자막만 읽습니다.',
  file: '극장 없이 시험할 때 씁니다. 한글 자막이 박힌 영상 파일을 고르면 카메라 대신 그 화면을 읽습니다. 파일은 보내지 않습니다.',
  stop: '자막 읽기와 카메라를 바로 끕니다.',
  shutter: '누르면 자막 읽기를 시작하거나 멈춥니다.',
  voice: '성별과 연령마다 다른 사람 목소리를 씁니다. 같은 성별이라도 아이·청년·중년·노년은 화자가 다릅니다.',
  speed: '자막을 읽는 빠르기입니다. 기본은 1.15배입니다. 너무 빠르면 알아듣기 어려울 수 있습니다.',
  zone: '표준 극장 자막은 화면 아래 가운데, 흰 글자에 어두운 테두리입니다. 그 부분이 노란 칸에 오게 맞추세요.',
  settings: '글자 크기, 읽기 속도, 목소리, 자막 위치를 바꿉니다. 한번 정하면 다음에 그대로 씁니다.',
  gender: '남성과 여성, 중성은 아예 다른 사람 목소리입니다.',
  age: '아이·청년·중년·노년도 각각 다른 TTS 화자입니다. 속도만 바꾸는 게 아닙니다.',
  region: '표준은 아래만 봅니다. 자막이 위에 뜨는 작품만 위로 바꾸세요.',
  scale: '녹내장 등 저시력을 위해 글자를 더 키울 수 있습니다.',
};

export function bindHelp(root = document) {
  root.querySelectorAll('[data-help]').forEach((btn) => {
    if (btn.dataset.helpBound) return;
    btn.dataset.helpBound = '1';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showHelp(btn.getAttribute('data-help'));
    });
  });
}

export function showHelp(key) {
  const text = HELP[key] || '이 버튼의 설명을 아직 적지 않았습니다.';
  const dialog = document.getElementById('help-dialog');
  const body = document.getElementById('help-body');
  if (!dialog || !body) return;
  body.textContent = text;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}
