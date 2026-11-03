import { formatContactPhone, normalizeContactPhone, serviceContactUrl } from '../lib/service-contact';

export function initServiceContact() {
  document.querySelectorAll<HTMLElement>('[data-service-contact]').forEach(section => {
    const form = section.querySelector<HTMLFormElement>('[data-contact-form]')!;
    const widget = section.querySelector<HTMLElement>('[data-contact-widget]')!;
    const name = form.querySelector<HTMLInputElement>('[name=name]')!;
    const phone = form.querySelector<HTMLInputElement>('[name=phone]')!;
    const heading = section.querySelector<HTMLElement>('#contact-step-heading')!;
    const intro = section.querySelector<HTMLElement>('[data-contact-intro]')!;
    const error = form.querySelector<HTMLElement>('#contact-error')!;
    const next = form.querySelector<HTMLButtonElement>('[data-contact-next]')!;
    const back = form.querySelector<HTMLButtonElement>('[data-contact-back]')!;
    const send = form.querySelector<HTMLAnchorElement>('[data-contact-send]')!;
    const steps = [...form.querySelectorAll<HTMLElement>('[data-contact-step]')];
    const selected = (field: string) => form.querySelector<HTMLInputElement>(`input[name="${field}"]:checked`);
    const titles = ['Como podemos chamar você?', 'Qual é o seu WhatsApp?', 'Qual cuidado você procura?', 'Qual unidade você prefere?', 'Vamos conversar?'];
    const descriptions = ['Uma conversa é o primeiro passo para um cuidado pensado para você.', 'Informe seu número com DDD para facilitar o contato com a equipe.', 'Você pode esclarecer suas dúvidas com a equipe antes de decidir.', 'Escolha a unidade em que deseja atendimento.', 'Confira seus dados antes de seguir para a conversa.'];
    let step = 0;
    function clearError() {
      error.hidden = true; error.textContent = '';
      form.querySelectorAll('[aria-invalid]').forEach(field => field.removeAttribute('aria-invalid'));
    }
    function showStep(focus = false) {
      clearError();
      steps.forEach((panel, index) => { panel.hidden = index !== step; });
      heading.textContent = titles[step]; intro.textContent = descriptions[step];
      section.querySelector<HTMLElement>('[data-contact-progress]')!.textContent = `Etapa ${step + 1} de 5`;
      section.querySelectorAll<HTMLElement>('[data-progress-step]').forEach((bar, index) => bar.toggleAttribute('data-complete', index <= step));
      next.hidden = step === 4; send.hidden = step !== 4; back.hidden = step === 0;
      if (step === 4) {
        const interest = selected('interest')!, unit = selected('unit')!;
        const data = {name: name.value, phone: phone.value, interest: interest.value, unit: unit.dataset.label!, recipient: unit.dataset.phone!, page: section.dataset.page!};
        for (const [key, value] of Object.entries({name: name.value.trim(), phone: `+55 ${formatContactPhone(normalizeContactPhone(phone.value)!)}`, interest: interest.value, unit: data.unit})) {
          form.querySelector<HTMLElement>(`[data-review="${key}"]`)!.textContent = value;
        }
        send.href = serviceContactUrl(data); send.dataset.whatsapp = unit.value;
      } else { send.removeAttribute('href'); send.dataset.whatsapp = ''; }
      // Never move focus on load. After an action, reveal the next control even
      // when the preceding step was taller than the mobile/zoomed viewport.
      if (focus) (step === 0 ? name : step === 1 ? phone : step === 2 ? selected('interest') || steps[2].querySelector<HTMLInputElement>('input') : step === 3 ? selected('unit') || steps[3].querySelector<HTMLInputElement>('input') : heading)?.focus();
    }
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (step === 4) return;
      clearError();
      const message = step === 0 && !name.value.trim() ? 'Digite seu nome para continuar.'
        : step === 1 && !normalizeContactPhone(phone.value) ? 'Digite um telefone brasileiro com DDD e 10 ou 11 dígitos.'
        : step === 2 && !selected('interest') ? 'Escolha um serviço ou selecione “Ainda não sei”.'
        : step === 3 && !selected('unit') ? 'Escolha a unidade em que deseja atendimento.' : '';
      if (message) {
        const target = step === 0 ? name : step === 1 ? phone : steps[step];
        target.setAttribute('aria-invalid', 'true'); error.hidden = false; error.textContent = message;
        (target instanceof HTMLInputElement ? target : target.querySelector<HTMLInputElement>('input'))?.focus();
        return;
      }
      step++; showStep(true);
    });
    back.addEventListener('click', () => { step = Math.max(0, step - 1); showStep(true); });
    form.addEventListener('input', clearError);
    form.addEventListener('change', clearError);
    phone.addEventListener('blur', () => { const normalized = normalizeContactPhone(phone.value); if (normalized) phone.value = formatContactPhone(normalized); });
    showStep(); widget.hidden = false;
    section.querySelector<HTMLElement>('[data-contact-fallback]')!.hidden = true;
  });
}
