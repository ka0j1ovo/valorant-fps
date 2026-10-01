// 开局设置：开镜方式 + 首关敌人数量
const Settings = (function () {
  let adsMode = 'hold';        // 'hold' 长按 | 'toggle' 点击
  let firstRoundCount = 5;     // 首关敌人 5~10

  function init(onStart) {
    const panel = document.getElementById('start-panel');
    const adsGroup = document.getElementById('ads-mode');
    const countGroup = document.getElementById('round-count');

    function selectOption(group, value) {
      group.querySelectorAll('.opt').forEach(b => {
        b.classList.toggle('selected', b.dataset.value === value);
      });
    }

    adsGroup.addEventListener('click', e => {
      const b = e.target.closest('.opt');
      if (!b) return;
      adsMode = b.dataset.value;
      selectOption(adsGroup, adsMode);
    });

    countGroup.addEventListener('click', e => {
      const b = e.target.closest('.opt');
      if (!b) return;
      firstRoundCount = parseInt(b.dataset.value, 10);
      selectOption(countGroup, String(firstRoundCount));
    });

    selectOption(adsGroup, adsMode);
    selectOption(countGroup, String(firstRoundCount));

    document.getElementById('start-btn').addEventListener('click', () => {
      panel.style.display = 'none';
      onStart();
    });
  }

  return {
    init,
    getAdsMode: () => adsMode,
    getFirstRoundCount: () => firstRoundCount,
  };
})();
