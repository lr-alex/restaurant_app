document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('form[data-confirm]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      if (!window.confirm(form.dataset.confirm || 'Continue?')) {
        event.preventDefault();
      }
    });
  });

  document.querySelectorAll('.party-step').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.target);
      if (!input) {
        return;
      }
      const step = Number(button.dataset.step);
      const min = Number(input.min || 1);
      const max = Number(input.max || 99);
      input.value = Math.min(max, Math.max(min, Number(input.value || min) + step));
    });
  });

  document.querySelectorAll('.booking-form').forEach((form) => {
    const branchSelect = form.querySelector('.branch-select');
    const picker = form.querySelector('[data-slot-picker]');
    const note = form.querySelector('[data-branch-note]');
    const startInput = form.querySelector('[data-slot-start]');
    const endInput = form.querySelector('[data-slot-end]');
    if (!branchSelect || !picker || !startInput || !endInput) {
      return;
    }

    const drawSlots = (keepExisting) => {
      const option = branchSelect.selectedOptions[0];
      if (!option) {
        return;
      }
      const slots = JSON.parse(option.dataset.slots || '[]');
      const selectedStart = keepExisting ? startInput.value : '';
      const selectedEnd = keepExisting ? endInput.value : '';
      picker.querySelectorAll('button').forEach((button) => button.remove());
      picker.querySelector('.slot-empty')?.remove();

      if (note) {
        note.textContent = `${option.dataset.address} · ${option.dataset.hours} · ${option.dataset.restDay}`;
      }

      if (!slots.length) {
        const empty = document.createElement('span');
        empty.className = 'slot-empty';
        empty.textContent = 'No slots are configured for this branch.';
        picker.appendChild(empty);
        startInput.value = '';
        endInput.value = '';
        return;
      }

      let matched = false;
      slots.forEach((slot) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'slot-button';
        button.textContent = `${slot.startTime}–${slot.endTime}`;
        button.dataset.start = slot.startTime;
        button.dataset.end = slot.endTime;
        if (slot.startTime === selectedStart && slot.endTime === selectedEnd) {
          button.classList.add('selected');
          matched = true;
        }
        button.addEventListener('click', () => {
          picker.querySelectorAll('.slot-button').forEach((item) => {
            item.classList.remove('selected');
          });
          button.classList.add('selected');
          startInput.value = slot.startTime;
          endInput.value = slot.endTime;
        });
        picker.appendChild(button);
      });

      if (!matched) {
        startInput.value = '';
        endInput.value = '';
      }
    };

    drawSlots(true);
    branchSelect.addEventListener('change', () => drawSlots(false));
  });
});
