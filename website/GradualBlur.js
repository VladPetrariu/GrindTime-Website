const DEFAULT_CONFIG = {
  position: 'bottom',
  strength: 2,
  height: '6rem',
  divCount: 5,
  exponential: false,
  zIndex: 1000,
  animated: false,
  duration: '0.3s',
  easing: 'ease-out',
  opacity: 1,
  curve: 'linear',
  target: 'parent',
  className: '',
  style: {}
};

const CURVE_FUNCTIONS = {
  linear: p => p,
  bezier: p => p * p * (3 - 2 * p),
  'ease-in': p => p * p,
  'ease-out': p => 1 - Math.pow(1 - p, 2),
  'ease-in-out': p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2)
};

const mergeConfigs = (...configs) => configs.reduce((acc, c) => ({ ...acc, ...c }), {});

const getGradientDirection = position =>
  ({
    top: 'to top',
    bottom: 'to bottom',
    left: 'to left',
    right: 'to right'
  })[position] || 'to bottom';

const toCssSize = value => (typeof value === 'number' ? `${value}px` : value);

export default class GradualBlur {
  constructor(targetEl, options = {}) {
    if (!targetEl) {
      throw new Error('GradualBlur: target element is required.');
    }
    this.targetEl = targetEl;
    this.config = mergeConfigs(DEFAULT_CONFIG, options);
    this.containerEl = null;
    this.innerEl = null;
    this.observer = null;
    this.isVisible = this.config.animated === 'scroll' ? false : true;
    this.init();
  }

  init() {
    const mountEl = this.getMountEl();
    if (!mountEl) return;
    this.ensurePosition(mountEl);
    this.build(mountEl);
    this.setupObserver();
  }

  getMountEl() {
    if (this.config.target === 'page') return document.body;
    return this.targetEl;
  }

  ensurePosition(el) {
    if (this.config.target === 'page') return;
    const style = window.getComputedStyle(el);
    if (style.position === 'static') {
      el.style.position = 'relative';
    }
  }

  build(mountEl) {
    const config = this.config;
    const isPageTarget = config.target === 'page';
    const isVertical = config.position === 'top' || config.position === 'bottom';
    const isHorizontal = config.position === 'left' || config.position === 'right';

    const container = document.createElement('div');
    container.className = `gradual-blur ${isPageTarget ? 'gradual-blur-fixed' : 'gradual-blur-parent'} ${
      config.className
    }`.trim();

    const style = container.style;
    style.position = isPageTarget ? 'fixed' : 'absolute';
    style.pointerEvents = 'none';
    style.opacity = this.isVisible ? String(config.opacity) : '0';
    if (config.animated) {
      style.transition = `opacity ${config.duration} ${config.easing}`;
    }
    style.zIndex = String(isPageTarget ? config.zIndex + 100 : config.zIndex);

    if (config.style && typeof config.style === 'object') {
      Object.assign(style, config.style);
    }

    if (isVertical) {
      style.height = toCssSize(config.height);
      style.width = config.width ? toCssSize(config.width) : '100%';
      style.left = '0';
      style.right = '0';
      style[config.position] = '0';
    } else if (isHorizontal) {
      style.width = config.width ? toCssSize(config.width) : toCssSize(config.height);
      style.height = '100%';
      style.top = '0';
      style.bottom = '0';
      style[config.position] = '0';
    }

    const inner = document.createElement('div');
    inner.className = 'gradual-blur-inner';

    const blurDivs = this.createBlurDivs();
    blurDivs.forEach(div => inner.appendChild(div));

    container.appendChild(inner);
    mountEl.appendChild(container);

    this.containerEl = container;
    this.innerEl = inner;
  }

  createBlurDivs() {
    const config = this.config;
    const divs = [];
    const increment = 100 / config.divCount;
    const curveFunc = CURVE_FUNCTIONS[config.curve] || CURVE_FUNCTIONS.linear;

    for (let i = 1; i <= config.divCount; i++) {
      let progress = i / config.divCount;
      progress = curveFunc(progress);

      let blurValue;
      if (config.exponential) {
        blurValue = Math.pow(2, progress * 4) * 0.0625 * config.strength;
      } else {
        blurValue = 0.0625 * (progress * config.divCount + 1) * config.strength;
      }

      const p1 = Math.round((increment * i - increment) * 10) / 10;
      const p2 = Math.round(increment * i * 10) / 10;
      const p3 = Math.round((increment * i + increment) * 10) / 10;
      const p4 = Math.round((increment * i + increment * 2) * 10) / 10;

      let gradient = `transparent ${p1}%, black ${p2}%`;
      if (p3 <= 100) gradient += `, black ${p3}%`;
      if (p4 <= 100) gradient += `, transparent ${p4}%`;
      let fillGradient = `transparent ${p1}%, rgba(0, 0, 0, 0.28) ${p2}%`;
      if (p3 <= 100) fillGradient += `, rgba(0, 0, 0, 0.28) ${p3}%`;
      if (p4 <= 100) fillGradient += `, transparent ${p4}%`;

      const direction = getGradientDirection(config.position);
      const div = document.createElement('div');
      const style = div.style;
      style.position = 'absolute';
      style.inset = '0';
      style.setProperty('mask-image', `linear-gradient(${direction}, ${gradient})`);
      style.setProperty('-webkit-mask-image', `linear-gradient(${direction}, ${gradient})`);
      style.setProperty('backdrop-filter', `blur(${blurValue.toFixed(3)}rem)`);
      style.setProperty('-webkit-backdrop-filter', `blur(${blurValue.toFixed(3)}rem)`);
      style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
      style.backgroundImage = `linear-gradient(${direction}, ${fillGradient})`;
      style.opacity = String(config.opacity);
      if (config.animated && config.animated !== 'scroll') {
        style.transition = `backdrop-filter ${config.duration} ${config.easing}`;
      }
      divs.push(div);
    }

    return divs;
  }

  setupObserver() {
    if (this.config.animated !== 'scroll') {
      this.setVisible(true);
      return;
    }
    if (!('IntersectionObserver' in window)) {
      this.setVisible(true);
      return;
    }
    this.setVisible(false);
    this.observer = new IntersectionObserver(
      ([entry]) => {
        this.setVisible(entry.isIntersecting);
      },
      { threshold: 0.1, rootMargin: '0px 0px -10% 0px' }
    );
    this.observer.observe(this.targetEl);
  }

  setVisible(isVisible) {
    this.isVisible = isVisible;
    if (this.containerEl) {
      this.containerEl.style.opacity = isVisible ? String(this.config.opacity) : '0';
    }
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.containerEl && this.containerEl.parentNode) {
      this.containerEl.parentNode.removeChild(this.containerEl);
    }
    this.containerEl = null;
    this.innerEl = null;
  }
}
