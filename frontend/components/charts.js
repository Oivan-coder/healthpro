window.Charts = (() => {
  const colors = ["#007aff", "#ff9500", "#34c759", "#af52de", "#ff3b30", "#5ac8fa"];

  function palette(index) {
    return colors[index % colors.length];
  }

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

  function drawDashboardTrendChart(canvas, labs) {
    if (!canvas || !labs?.length) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const cssHeight = window.innerWidth <= 820 ? 250 : 320;
    const series = labs
      .map((lab) => {
        const low = Number(String(lab.low ?? "").replace(",", "."));
        const high = Number(String(lab.high ?? "").replace(",", "."));
        const history = [...(lab.history || [])]
          .slice(-8)
          .map((point) => ({
            ...point,
            numericValue: Number(String(point.value ?? "").replace(",", "."))
          }))
          .filter((point) => Number.isFinite(point.numericValue));
        if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low || history.length < 2) return null;
        return {
          lab,
          low,
          high,
          history: history.map((point) => ({
            ...point,
            normalized: (point.numericValue - low) / (high - low)
          }))
        };
      })
      .filter(Boolean);

    if (!series.length) {
      ctx.clearRect(0, 0, rect.width || 520, cssHeight);
      return;
    }

    canvas.width = Math.max(320, rect.width * dpr);
    canvas.height = cssHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width || 520;
    const h = cssHeight;
    const isCompact = window.innerWidth <= 520;
    const pad = { left: isCompact ? 34 : 42, right: 24, top: 34, bottom: isCompact ? 42 : 48 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;
    const allValues = series.flatMap(item => item.history.map(point => point.normalized));
    const minNorm = Math.min(-0.25, ...allValues);
    const maxNorm = Math.max(1.35, ...allValues);
    const normRange = Math.max(0.01, maxNorm - minNorm);
    const y = value => pad.top + plotH - ((value - minNorm) / normRange) * plotH;
    const points = [];

    ctx.clearRect(0, 0, w, h);

    const yNormalTop = y(1);
    const yNormalBottom = y(0);
    ctx.fillStyle = "rgba(87,178,123,.12)";
    ctx.fillRect(pad.left, yNormalTop, plotW, Math.max(1, yNormalBottom - yNormalTop));

    ctx.strokeStyle = "rgba(17,24,39,.052)";
    ctx.lineWidth = 1;
    const gridValues = [minNorm, 0, 1, maxNorm].filter((value, index, arr) => index === 0 || Math.abs(value - arr[index - 1]) > 0.05);
    gridValues.forEach((value) => {
      const yy = y(value);
      ctx.beginPath();
      ctx.moveTo(pad.left, yy);
      ctx.lineTo(w - pad.right, yy);
      ctx.stroke();
    });

    ctx.setLineDash([6, 6]);
    [0, 1].forEach((value) => {
      ctx.strokeStyle = "rgba(87,178,123,.26)";
      ctx.beginPath();
      ctx.moveTo(pad.left, y(value));
      ctx.lineTo(w - pad.right, y(value));
      ctx.stroke();
    });
    ctx.setLineDash([]);

    drawRangeLabel(ctx, "выше диапазона", pad.left + 10, Math.max(18, y(1) - 16), "rgba(137,93,22,.78)", "rgba(255,247,235,.9)");
    drawRangeLabel(ctx, "обычный диапазон", pad.left + 10, y(.5) + 4, "rgba(41,124,73,.82)", "rgba(242,250,246,.92)");
    drawRangeLabel(ctx, "ниже диапазона", pad.left + 10, Math.min(h - pad.bottom - 8, y(0) + 20), "rgba(82,98,122,.72)", "rgba(248,250,252,.92)");

    series.forEach((item, labIndex) => {
      const { lab, history, low, high } = item;
      const x = i => pad.left + plotW * i / Math.max(1, history.length - 1);
      const linePoints = history.map((point, i) => ({ x: x(i), y: y(point.normalized) }));
      drawSmoothLine(ctx, linePoints);
      ctx.strokeStyle = palette(labIndex);
      ctx.lineWidth = 3.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();

      history.forEach((point, i) => {
        const xx = x(i);
        const yy = y(point.normalized);
        points.push({ x: xx, y: yy, lab, point, low, high, color: palette(labIndex) });
        ctx.fillStyle = "rgba(255,255,255,.96)";
        ctx.beginPath();
        ctx.arc(xx, yy, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = palette(labIndex);
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    });

    const labelHistory = series[0].history;
    ctx.fillStyle = "rgba(107,114,128,.78)";
    ctx.textAlign = "center";
    ctx.font = `${isCompact ? 11 : 12}px -apple-system, BlinkMacSystemFont, Segoe UI`;
    labelHistory.forEach((point, i) => {
      if (labelHistory.length > 5 && i % 2 === 1 && i !== labelHistory.length - 1) return;
      const xx = pad.left + plotW * i / Math.max(1, labelHistory.length - 1);
      ctx.fillText(dateLabel(point.date), xx, h - 18);
    });
    ctx.textAlign = "left";

    ctx.fillStyle = "rgba(107,114,128,.9)";
    ctx.font = "12px -apple-system, BlinkMacSystemFont, Segoe UI";
    attachDashboardTooltip(canvas, points);
  }

  function drawRangeLabel(ctx, text, x, y, color, background) {
    ctx.save();
    ctx.font = "700 11px -apple-system, BlinkMacSystemFont, Segoe UI";
    const width = ctx.measureText(text).width + 16;
    const height = 22;
    const radius = 11;
    ctx.fillStyle = background;
    roundRect(ctx, x, y - height / 2, width, height, radius);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillText(text, x + 8, y + 4);
    ctx.restore();
  }

  function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function drawSmoothLine(ctx, points) {
    if (!points.length) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const current = points[i];
      const midX = (prev.x + current.x) / 2;
      const midY = (prev.y + current.y) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
  }

  function dateLabel(date) {
    const raw = String(date || "");
    const parts = raw.split(".");
    if (parts.length >= 2) return `${parts[0]}.${parts[1]}`;
    return raw.slice(0, 5);
  }

  function attachDashboardTooltip(canvas, points) {
    if (!canvas || !points?.length) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    parent.style.position = parent.style.position || "relative";
    let tooltip = parent.querySelector(".chart-tooltip");
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.className = "chart-tooltip";
      parent.appendChild(tooltip);
    }
    canvas.onmousemove = (event) => {
      const rect = canvas.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;
      const nearest = points
        .map(point => ({ point, distance: Math.hypot(point.x - mx, point.y - my) }))
        .sort((a, b) => a.distance - b.distance)[0];
      if (!nearest || nearest.distance > 24) {
        tooltip.classList.remove("show");
        return;
      }
      const { point } = nearest;
      tooltip.innerHTML = `
        <b>${point.lab.name}</b>
        <span>${point.point.date || ""}</span>
        <span>${point.point.value} ${point.lab.unit || ""}</span>
        <small>Референс: ${point.low}–${point.high} ${point.lab.unit || ""}</small>
      `;
      tooltip.style.left = `${Math.min(rect.width - 180, Math.max(8, point.x + 12))}px`;
      tooltip.style.top = `${Math.max(8, point.y - 18)}px`;
      tooltip.classList.add("show");
    };
    canvas.onmouseleave = () => tooltip.classList.remove("show");
  }

  return { drawLabChart, drawDashboardTrendChart, palette };
})();
