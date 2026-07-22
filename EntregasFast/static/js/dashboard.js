(function () {
  "use strict";

  Cargo.setRole("cliente");

  /* ---------- Panel switch (Seguimiento / Registrar) ---------- */
  var switchBtns = document.querySelectorAll(".dash-switch button");
  var panels = {
    tracking: document.getElementById("panel-tracking"),
    register: document.getElementById("panel-register")
  };

  switchBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      switchBtns.forEach(function (b) {
        b.classList.remove("is-active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");
      Object.keys(panels).forEach(function (key) {
        panels[key].classList.toggle("is-active", key === btn.dataset.panel);
      });
    });
  });

  function goToTrackingPanel() {
    var trackBtn = document.querySelector('.dash-switch button[data-panel="tracking"]');
    if (trackBtn) trackBtn.click();
  }

  /* ---------- Toast ---------- */
  var toast = document.getElementById("dashToast");
  var toastTitle = document.getElementById("toastTitle");
  var toastBody = document.getElementById("toastBody");
  var toastTimer = null;
  function showToast(title, body) {
    toastTitle.textContent = title;
    toastBody.textContent = body;
    toast.classList.add("is-shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("is-shown"); }, 4200);
  }

  /* ---------- Filtros ---------- */
  var toggleFilters = document.getElementById("toggleFilters");
  var filterChips = document.getElementById("filterChips");
  toggleFilters.addEventListener("click", function () {
    filterChips.style.display = filterChips.style.display === "none" ? "flex" : "none";
  });

  var fltEstado = document.getElementById("fltEstado");
  Cargo.ESTADOS.forEach(function (e) {
    var opt = document.createElement("option");
    opt.value = e; opt.textContent = e;
    fltEstado.appendChild(opt);
  });
  var fltPrioridad = document.getElementById("fltPrioridad");
  var fltCiudad = document.getElementById("fltCiudad");
  var orderSearch = document.getElementById("orderSearch");

  /* ---------- Order list ---------- */
  var orderList = document.getElementById("orderList");
  var selectedCodigo = null;

  function renderOrderList() {
    var items = Cargo.filtrarPaquetes({
      query: orderSearch.value,
      estado: fltEstado.value,
      prioridad: fltPrioridad.value,
      ciudad: fltCiudad.value
    });

    orderList.innerHTML = "";

    if (!items.length) {
      orderList.innerHTML = '<div class="empty-state">No hay paquetes registrados todavía. Usa "Registrar paquete" para crear el primero.</div>';
      return;
    }

    items.forEach(function (p) {
      var card = document.createElement("article");
      card.className = "order-card" + (p.codigo === selectedCodigo ? " is-selected" : "");
      card.dataset.order = p.codigo;
      var pct = Cargo.progresoPorcentaje(p.estado);
      var cls = Cargo.ESTADO_CLASS[p.estado] || "status-checking";

      var lastSteps = p.historial.slice(-3);
      var miniSteps = lastSteps.map(function (h) {
        return '<div class="mini-step done"><span class="dot"></span><span class="label">' + h.estado + '</span><span class="time">' + h.fecha + ' · ' + h.hora + '</span></div>';
      }).join("");

      card.innerHTML =
        '<div class="order-card-top">' +
          '<div class="order-id">Folio: #' + p.codigo + '<small>' + p.origen + ' → ' + p.destino + '</small></div>' +
          '<span class="status-badge ' + cls + '">' + p.estado + '</span>' +
        '</div>' +
        '<div class="order-progress"><span style="width:' + pct + '%"></span></div>' +
        '<div class="mini-steps">' + miniSteps + '</div>';

      orderList.appendChild(card);
    });
  }

  orderList.addEventListener("click", function (e) {
    var card = e.target.closest(".order-card");
    if (card) selectOrder(card.dataset.order);
  });

  [orderSearch, fltEstado, fltPrioridad, fltCiudad].forEach(function (el) {
    el.addEventListener("input", renderOrderList);
    el.addEventListener("change", renderOrderList);
  });

  /* ---------- Detail rendering ---------- */
  var detailCard = document.getElementById("detailCard");
  var noSelection = document.getElementById("noSelection");
  var detailOid = document.getElementById("detailOid");
  var detailRoute = document.getElementById("detailRoute");
  var detailStatusBadge = document.getElementById("detailStatusBadge");
  var detailTimeline = document.getElementById("detailTimeline");
  var detailSummary = document.getElementById("detailSummary");

  function selectOrder(codigo) {
    selectedCodigo = codigo;
    renderOrderList();
    var p = Cargo.obtenerPaquete(codigo);
    if (!p) return;

    detailCard.style.display = "";
    noSelection.style.display = "none";

    detailOid.textContent = "#" + p.codigo;
    detailRoute.textContent = p.origen + " → " + p.destino;
    var cls = Cargo.ESTADO_CLASS[p.estado] || "status-checking";
    detailStatusBadge.className = "status-badge " + cls;
    detailStatusBadge.textContent = p.estado;

    detailTimeline.innerHTML = "";
    if (!p.historial.length) {
      detailTimeline.innerHTML = '<div class="tt-empty">Sin eventos registrados.</div>';
    } else {
      p.historial.slice().reverse().forEach(function (h, idx) {
        var isCurrent = idx === 0;
        var div = document.createElement("div");
        div.className = "tt-step done" + (isCurrent ? " current" : "");
        div.innerHTML =
          '<div class="tt-dot"></div>' +
          '<div class="tt-title">' + h.estado + '</div>' +
          '<div class="tt-meta">' + h.fecha + ' · ' + h.hora + ' — ' + h.usuario + '</div>' +
          (h.observacion ? '<div class="tt-obs">' + h.observacion + '</div>' : "");
        detailTimeline.appendChild(div);
      });
    }

    var conductor = Cargo.obtenerConductor(p.conductorId);

    detailSummary.innerHTML =
      '<div class="stat"><div class="k"><span class="icon-map-pin"></span> Estado actual</div><div class="v">' + p.estado + '</div></div>' +
      '<div class="stat"><div class="k"><span class="icon-dashboard2"></span> Prioridad</div><div class="v">' + p.prioridad + '</div></div>' +
      '<div class="stat"><div class="k"><span class="icon-map2"></span> Peso</div><div class="v">' + p.peso + ' kg</div></div>' +
      '<div class="stat"><div class="k"><span class="icon-list2"></span> Conductor</div><div class="v">' + (conductor ? conductor.nombre + " " + conductor.apellido : "—") + '</div></div>';

    document.getElementById("paneDetallesPedido").innerHTML =
      '<div class="row-item"><span>Tipo de servicio</span><span>Carga terrestre</span></div>' +
      '<div class="row-item"><span>Peso</span><span>' + p.peso + ' kg</span></div>' +
      '<div class="row-item"><span>Volumen de carga</span><span>' + (p.volumen || "—") + (p.volumen ? " m³" : "") + '</span></div>' +
      '<div class="row-item"><span>Prioridad</span><span>' + p.prioridad + '</span></div>' +
      '<div class="row-item"><span>Descripción</span><span>' + (p.descripcion || "—") + '</span></div>' +
      '<div class="row-item"><span>Fecha de registro</span><span>' + p.fechaCreacion + '</span></div>';

    document.getElementById("paneVehiculo").innerHTML = conductor ?
      '<div class="row-item"><span>Vehículo</span><span>' + conductor.marca + ' ' + conductor.modelo + '</span></div>' +
      '<div class="row-item"><span>Placa</span><span>' + conductor.placa + '</span></div>' :
      '<div class="row-item"><span>Vehículo</span><span>No asignado</span></div>';

    document.getElementById("paneConductor").innerHTML = conductor ?
      '<div class="row-item"><span>Nombre</span><span>' + conductor.nombre + ' ' + conductor.apellido + '</span></div>' +
      '<div class="row-item"><span>Teléfono</span><span>' + conductor.telefono + '</span></div>' +
      '<div class="row-item"><span>Licencia</span><span>' + conductor.licencia + ' (' + conductor.tipoLicencia + ')</span></div>' :
      '<div class="row-item"><span>Conductor</span><span>No asignado</span></div>';

    document.getElementById("paneCliente").innerHTML =
      '<div class="row-item"><span>Remitente</span><span>' + p.remitente + '</span></div>' +
      '<div class="row-item"><span>Destinatario</span><span>' + p.destinatario + '</span></div>' +
      '<div class="row-item"><span>Tel. remitente</span><span>' + (p.telRemitente || "—") + '</span></div>' +
      '<div class="row-item"><span>Tel. destinatario</span><span>' + (p.telDestinatario || "—") + '</span></div>';
  }

  /* ---------- Info tabs ---------- */
  document.querySelectorAll(".info-tabs button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".info-tabs button").forEach(function (b) { b.classList.remove("is-active"); });
      btn.classList.add("is-active");
      document.querySelectorAll(".info-pane").forEach(function (p) {
        p.classList.toggle("is-active", p.dataset.pane === btn.dataset.tab);
      });
    });
  });

  /* ---------- QR modal ---------- */
  var qrModalOverlay = document.getElementById("qrModalOverlay");
  var qrModalCodigo = document.getElementById("qrModalCodigo");
  var qrCanvasHolder = document.getElementById("qrCanvasHolder");

  document.getElementById("btnVerQR").addEventListener("click", function () {
    if (!selectedCodigo) return;
    qrModalCodigo.textContent = selectedCodigo;
    qrCanvasHolder.innerHTML = "";
    new QRCode(qrCanvasHolder, {
      text: CargoPDF.urlRastreo(selectedCodigo),
      width: 200, height: 200
    });
    qrModalOverlay.classList.add("is-shown");
  });
  document.getElementById("closeQrModal").addEventListener("click", function () {
    qrModalOverlay.classList.remove("is-shown");
  });
  qrModalOverlay.addEventListener("click", function (e) {
    if (e.target === qrModalOverlay) qrModalOverlay.classList.remove("is-shown");
  });

  /* ---------- Descargar hoja de ruta / imprimir ---------- */
  document.getElementById("btnDescargarHoja").addEventListener("click", function () {
    if (!selectedCodigo) { showToast("Selecciona un paquete", "Elige un folio de la lista primero."); return; }
    CargoPDF.generarHojaDeRuta(selectedCodigo);
  });
  document.getElementById("btnImprimir").addEventListener("click", function () {
    window.print();
  });

  /* ---------- Register form ---------- */
  var fOrigin = document.getElementById("fOrigin");
  var fDest = document.getElementById("fDest");
  var fWeight = document.getElementById("fWeight");
  var fConductor = document.getElementById("fConductor");
  var prevRoute = document.getElementById("prevRoute");
  var prevWeight = document.getElementById("prevWeight");
  var prevPriority = document.getElementById("prevPriority");
  var prevFolio = document.getElementById("prevFolio");
  var registerForm = document.getElementById("registerForm");

  function fillConductorSelect() {
    var activos = Cargo.listarConductores().filter(function (c) { return c.estado === "Activo"; });
    fConductor.innerHTML = '<option value="">— Selecciona —</option>';
    activos.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.nombre + " " + c.apellido + " — " + c.placa;
      fConductor.appendChild(opt);
    });
    if (!activos.length) {
      var opt = document.createElement("option");
      opt.value = ""; opt.disabled = true;
      opt.textContent = "No hay conductores activos registrados";
      fConductor.appendChild(opt);
    }
  }

  function updatePreview() {
    var origin = fOrigin.value.trim() || "—";
    var dest = fDest.value.trim() || "—";
    prevRoute.textContent = origin + " → " + dest;
    prevWeight.textContent = (fWeight.value || "—") + " kg";
    var priority = document.querySelector('input[name="priority"]:checked');
    prevPriority.textContent = priority ? priority.value : "—";
  }
  ["input", "change"].forEach(function (evt) {
    registerForm.addEventListener(evt, updatePreview);
  });

  registerForm.addEventListener("submit", function (e) {
    e.preventDefault();

    if (!fConductor.value) {
      showToast("Falta el conductor", "Debes seleccionar un conductor antes de registrar el paquete.");
      return;
    }

    var data = {
      remitente: document.getElementById("fSender").value.trim(),
      telRemitente: document.getElementById("fSenderPhone").value.trim(),
      destinatario: document.getElementById("fReceiver").value.trim(),
      telDestinatario: document.getElementById("fReceiverPhone").value.trim(),
      origen: fOrigin.value.trim(),
      destino: fDest.value.trim(),
      peso: fWeight.value,
      volumen: document.getElementById("fVolume").value,
      descripcion: document.getElementById("fDescription").value.trim(),
      prioridad: document.querySelector('input[name="priority"]:checked').value,
      conductorId: fConductor.value
    };

    if (!data.remitente || !data.destinatario || !data.origen || !data.destino || !data.peso) {
      showToast("Faltan datos", "Completa remitente, destinatario, origen, destino y peso.");
      return;
    }

    var paquete = Cargo.registrarPaquete(data);
    prevFolio.textContent = "#" + paquete.codigo;

    showToast("Paquete registrado", "Folio #" + paquete.codigo + " agregado al seguimiento.");

    registerForm.reset();
    document.getElementById("pStd").checked = true;
    updatePreview();
    fillConductorSelect();

    renderOrderList();
    selectOrder(paquete.codigo);

    setTimeout(goToTrackingPanel, 900);
  });

  document.getElementById("clearForm").addEventListener("click", function () {
    registerForm.reset();
    document.getElementById("pStd").checked = true;
    updatePreview();
  });

  /* ---------- Init ---------- */
  fillConductorSelect();
  updatePreview();
  renderOrderList();
  var first = Cargo.listarPaquetes()[0];
  if (first) selectOrder(first.codigo);

})();
