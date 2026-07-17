window.Charts = (() => {
  function drawLabChart(canvas, lab) {
    if (!canvas || !lab) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const cssHeight = window.innerWidth <= 820 ? (window.innerWidth <= 430 ? 240 : 260) : 330;

    canvas.width = Math.max(320, rect.width * dpr);
    canvas.height = cssHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width || 800;
    const h = cssHeight;
    ctx.clearRect(0, 0, w, h);

    const pad = { left: 58, right: 30, top: 30, bottom: 50 };
    const values = lab.history.map(x => x.value);
    const min = Math.min(...values, lab.low) * .90;
    const max = Math.max(...values, lab.high) * 1.10;
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    const x = i => pad.left + plotW * i / Math.max(1, lab.history.length - 1);
    const y = v => pad.top + plotH - ((v - min) / Math.max(.001, max - min)) * plotH;

    const yLow = y(lab.low), yHigh = y(lab.high);
    ctx.fillStyle = "rgba(52,199,89,.12)";
    ctx.fillRect(pad.left, Math.min(yLow, yHigh), plotW, Math.abs(yLow - yHigh));

    ctx.strokeStyle = "rgba(17,24,39,.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const yy = pad.top + plotH * i / 4;
      ctx.beginPath();
      ctx.moveTo(pad.left, yy);
      ctx.lineTo(w - pad.right, yy);
      ctx.stroke();
    }

    function refLine(value, label) {
      const yy = y(value);
      ctx.strokeStyle = "rgba(255,149,0,.82)";
      ctx.setLineDash([7, 7]);
      ctx.beginPath();
      ctx.moveTo(pad.left, yy);
      ctx.lineTo(w - pad.right, yy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(164,92,0,.95)";
      ctx.font = "12px -apple-system, BlinkMacSystemFont, Segoe UI";
      ctx.fillText(label, pad.left + 4, yy - 7);
    }

    refLine(lab.low, "нижняя граница");
    refLine(lab.high, "верхняя граница");

    const gradient = ctx.createLinearGradient(0, pad.top, 0, h - pad.bottom);
    gradient.addColorStop(0, "rgba(0,122,255,.22)");
    gradient.addColorStop(1, "rgba(0,122,255,0)");

    ctx.beginPath();
    lab.history.forEach((p, i) => {
      const xx = x(i), yy = y(p.value);
      if (i === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    });
    ctx.lineTo(x(lab.history.length - 1), h - pad.bottom);
    ctx.lineTo(x(0), h - pad.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    const stroke = lab.flag === "normal" ? "#34c759" : "#ff9500";
    ctx.beginPath();
    lab.history.forEach((p, i) => {
      const xx = x(i), yy = y(p.value);
      if (i === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    });
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    lab.history.forEach((p, i) => {
      const xx = x(i), yy = y(p.value);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(xx, yy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = "rgba(107,114,128,.95)";
      ctx.font = "12px -apple-system, BlinkMacSystemFont, Segoe UI";
      ctx.fillText(p.date.slice(0,5), xx - 15, h - 18);
    });

    ctx.fillStyle = "#111827";
    ctx.font = "800 13px -apple-system, BlinkMacSystemFont, Segoe UI";
    ctx.fillText(`${lab.name}: динамика`, pad.left, 21);
  }

  return { drawLabChart };
})();
