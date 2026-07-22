(function () {
  "use strict";

  if (typeof Cargo !== "undefined") {
    Cargo.setRole("cliente");
  }

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
        if (panels[key]) {
          panels[key].classList.toggle("is-active", key === btn.dataset.panel);
        }
      });
    });
  });

  /* ---------- Toast ---------- */
  var toast = document.getElementById("dashToast");
  var toastTitle = document.getElementById("toastTitle");
  var toastBody = document.getElementById("toastBody");
  var toastTimer = null;
  function showToast(title, body) {
    if (!toast || !toastTitle || !toastBody) return;
    toastTitle.textContent = title;
    toastBody.textContent = body;
    toast.classList.add("is-shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("is-shown"); }, 4200);
  }

  /* ---------- Filtros ---------- */
  var toggleFilters = document.getElementById("toggleFilters");
  var filterChips = document.getElementById("filterChips");
  if (toggleFilters && filterChips) {
    toggleFilters.addEventListener("click", function () {
      filterChips.style.display = filterChips.style.display === "none" ? "flex" : "none";
    });
  }

  var fltEstado = document.getElementById("fltEstado");
  if (fltEstado && typeof Cargo !== "undefined" && Cargo.ESTADOS) {
    Cargo.ESTADOS.forEach(function (e) {
      var opt = document.createElement("option");
      opt.value = e; opt.textContent = e;
      fltEstado.appendChild(opt);
    });
  }
  var fltPrioridad = document.getElementById("fltPrioridad");
  var fltCiudad = document.getElementById("fltCiudad");
  var orderSearch = document.getElementById("orderSearch");

  /* ---------- Order list ---------- */
  var orderList = document.getElementById("orderList");
  var selectedCodigo = null;

  function renderOrderList() {
    if (!orderList || typeof Cargo === "undefined") return;

    var items = Cargo.filtrarPaquetes({
      query: orderSearch ? orderSearch.value : "",
      estado: fltEstado ? fltEstado.value : "",
      prioridad: fltPrioridad ? fltPrioridad.value : "",
      ciudad: fltCiudad ? fltCiudad.value : ""
    });

    orderList.innerHTML = "";

    if (!items || !items.length) {
      orderList.innerHTML = '<div class="empty-state">No hay paquetes registrados todavía. Usa "Registrar paquete" para crear el primero.</div>';
      return;
    }

    items.forEach(function (p) {
      var card = document.createElement("article");
      card.className = "order-card" + (p.codigo === selectedCodigo ? " is-selected" : "");
      card.dataset.order = p.codigo;
      var pct = Cargo.progresoPorcentaje ? Cargo.progresoPorcentaje(p.estado) : 0;
      var cls = (Cargo.ESTADO_CLASS && Cargo.ESTADO_CLASS[p.estado]) || "status-checking";

      var lastSteps = p.historial ? p.historial.slice(-3) : [];
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

  if (orderList) {
    orderList.addEventListener("click", function (e) {
      var card = e.target.closest(".order-card");
      if (card) selectOrder(card.dataset.order);
    });
  }

  [orderSearch, fltEstado, fltPrioridad, fltCiudad].forEach(function (el) {
    if (el) {
      el.addEventListener("input", renderOrderList);
      el.addEventListener("change", renderOrderList);
    }
  });

/* ---------- Conductor select ---------- */
function fillConductorSelect() {
  var fConductor = document.getElementById("fConductor");
  if (!fConductor) return;

  // Si Django ya renderizó las opciones desde la base de datos, NO tocamos nada.
  // Esto evita que JS reemplace los IDs reales de la base de datos de Django.
  if (fConductor.options.length > 0) {
    return;
  }

  // Fallback opcional: solo en caso de que el select en el HTML esté completamente vacío (<select id="fConductor"></select>)
  if (typeof Cargo !== "undefined" && typeof Cargo.listarConductores === "function") {
    var activos = Cargo.listarConductores().filter(function (c) {
      return !c.estado || c.estado === "Activo";
    });

    activos.forEach(function (c, index) {
      var opt = document.createElement("option");
      // Forzamos un ID entero para mantener compatibilidad con Django
      opt.value = (!isNaN(c.id) && c.id !== null) ? parseInt(c.id, 10) : (index + 1);
      
      var infoVehiculo = c.vehiculo || (c.marca ? (c.marca + " " + (c.modelo || "")) : "") || "Sin vehículo";
      var placa = c.placa || c.placa_vehiculo || "Sin placa";

      opt.textContent = c.nombre + " " + c.apellido + " (" + placa + " · " + infoVehiculo.trim() + ")";
      fConductor.appendChild(opt);
    });
  }
}

  /* ---------- Detail rendering ---------- */
  var detailCard = document.getElementById("detailCard");
  var noSelection = document.getElementById("noSelection");
  var detailOid = document.getElementById("detailOid");
  var detailRoute = document.getElementById("detailRoute");
  var detailStatusBadge = document.getElementById("detailStatusBadge");
  var detailTimeline = document.getElementById("detailTimeline");
  var detailSummary = document.getElementById("detailSummary");

  function selectOrder(codigo) {
    if (typeof Cargo === "undefined") return;
    selectedCodigo = codigo;
    renderOrderList();
    var p = Cargo.obtenerPaquete(codigo);
    if (!p) return;

    if (detailCard) detailCard.style.display = "";
    if (noSelection) noSelection.style.display = "none";

    if (detailOid) detailOid.textContent = "#" + p.codigo;
    if (detailRoute) detailRoute.textContent = p.origen + " → " + p.destino;
    var cls = (Cargo.ESTADO_CLASS && Cargo.ESTADO_CLASS[p.estado]) || "status-checking";
    if (detailStatusBadge) {
      detailStatusBadge.className = "status-badge " + cls;
      detailStatusBadge.textContent = p.estado;
    }

    if (detailTimeline) {
      detailTimeline.innerHTML = "";
      if (!p.historial || !p.historial.length) {
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
    }

    var conductor = Cargo.obtenerConductor ? Cargo.obtenerConductor(p.conductorId) : null;

    if (detailSummary) {
      detailSummary.innerHTML =
        '<div class="stat"><div class="k"><span class="icon-map-pin"></span> Estado actual</div><div class="v">' + p.estado + '</div></div>' +
        '<div class="stat"><div class="k"><span class="icon-dashboard2"></span> Prioridad</div><div class="v">' + p.prioridad + '</div></div>' +
        '<div class="stat"><div class="k"><span class="icon-map2"></span> Peso</div><div class="v">' + p.peso + ' kg</div></div>' +
        '<div class="stat"><div class="k"><span class="icon-list2"></span> Conductor</div><div class="v">' + (conductor ? conductor.nombre + " " + conductor.apellido : "—") + '</div></div>';
    }

    var pDetalles = document.getElementById("paneDetallesPedido");
    if (pDetalles) {
      pDetalles.innerHTML =
        '<div class="row-item"><span>Tipo de servicio</span><span>Carga terrestre</span></div>' +
        '<div class="row-item"><span>Peso</span><span>' + p.peso + ' kg</span></div>' +
        '<div class="row-item"><span>Volumen de carga</span><span>' + (p.volumen || "—") + (p.volumen ? " m³" : "") + '</span></div>' +
        '<div class="row-item"><span>Prioridad</span><span>' + p.prioridad + '</span></div>' +
        '<div class="row-item"><span>Descripción</span><span>' + (p.descripcion || "—") + '</span></div>' +
        '<div class="row-item"><span>Fecha de registro</span><span>' + p.fechaCreacion + '</span></div>';
    }

    var pVehiculo = document.getElementById("paneVehiculo");
    if (pVehiculo) {
      pVehiculo.innerHTML = conductor ?
        '<div class="row-item"><span>Vehículo</span><span>' + conductor.marca + ' ' + conductor.modelo + '</span></div>' +
        '<div class="row-item"><span>Placa</span><span>' + conductor.placa + '</span></div>' :
        '<div class="row-item"><span>Vehículo</span><span>No asignado</span></div>';
    }

    var pConductor = document.getElementById("paneConductor");
    if (pConductor) {
      pConductor.innerHTML = conductor ?
        '<div class="row-item"><span>Nombre</span><span>' + conductor.nombre + ' ' + conductor.apellido + '</span></div>' +
        '<div class="row-item"><span>Teléfono</span><span>' + conductor.telefono + '</span></div>' +
        '<div class="row-item"><span>Licencia</span><span>' + conductor.licencia + ' (' + conductor.tipoLicencia + ')</span></div>' :
        '<div class="row-item"><span>Conductor</span><span>No asignado</span></div>';
    }

    var pCliente = document.getElementById("paneCliente");
    if (pCliente) {
      pCliente.innerHTML =
        '<div class="row-item"><span>Remitente</span><span>' + p.remitente + '</span></div>' +
        '<div class="row-item"><span>Destinatario</span><span>' + p.destinatario + '</span></div>' +
        '<div class="row-item"><span>Tel. remitente</span><span>' + (p.telRemitente || "—") + '</span></div>' +
        '<div class="row-item"><span>Tel. destinatario</span><span>' + (p.telDestinatario || "—") + '</span></div>';
    }
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

  var btnVerQR = document.getElementById("btnVerQR");
  if (btnVerQR) {
    btnVerQR.addEventListener("click", function () {
      if (!selectedCodigo) return;
      if (qrModalCodigo) qrModalCodigo.textContent = selectedCodigo;
      if (qrCanvasHolder) {
        qrCanvasHolder.innerHTML = "";
        if (typeof QRCode !== "undefined") {
          new QRCode(qrCanvasHolder, {
            text: selectedCodigo,
            width: 200, height: 200
          });
        } else {
          qrCanvasHolder.textContent = "Folio: " + selectedCodigo;
        }
      }
      if (qrModalOverlay) qrModalOverlay.classList.add("is-shown");
    });
  }

  var closeQrModal = document.getElementById("closeQrModal");
  if (closeQrModal) {
    closeQrModal.addEventListener("click", function () {
      if (qrModalOverlay) qrModalOverlay.classList.remove("is-shown");
    });
  }

  if (qrModalOverlay) {
    qrModalOverlay.addEventListener("click", function (e) {
      if (e.target === qrModalOverlay) qrModalOverlay.classList.remove("is-shown");
    });
  }

  /* ---------- Impresión ---------- */
  function imprimirPedido(codigo) {
    if (typeof Cargo === "undefined") return;
    var p = Cargo.obtenerPaquete(codigo);
    if (!p) return;

    if (typeof CargoPDF !== "undefined") {
      try {
        if (typeof CargoPDF.imprimirHojaDeRuta === "function") {
          CargoPDF.imprimirHojaDeRuta(codigo);
          return;
        }
        if (typeof CargoPDF.generarHojaDeRuta === "function") {
          CargoPDF.generarHojaDeRuta(codigo);
          return;
        }
      } catch (err) {
        console.warn("CargoPDF falló, usando fallback:", err);
      }
    }

    var conductor = Cargo.obtenerConductor ? Cargo.obtenerConductor(p.conductorId) : null;
    var printWindow = window.open("", "_blank", "width=800,height=600");

    var htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Hoja de Ruta - Folio #${p.codigo}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 25px; color: #111; line-height: 1.5; }
          h2 { margin-bottom: 5px; color: #1a1a1a; }
          hr { border: 0; border-top: 1px solid #ccc; margin: 15px 0; }
          .section { margin-bottom: 15px; }
          .label { font-weight: bold; }
          p { margin: 5px 0; }
        </style>
      </head>
      <body>
        <h2>CARGO — Hoja de Despacho</h2>
        <p><strong>Folio:</strong> #${p.codigo}</p>
        <hr>
        <div class="section">
          <p><span class="label">Ruta:</span> ${p.origen} → ${p.destino}</p>
          <p><span class="label">Estado:</span> ${p.estado}</p>
          <p><span class="label">Prioridad:</span> ${p.prioridad}</p>
        </div>
        <hr>
        <div class="section">
          <h3>Detalles de la Carga</h3>
          <p><span class="label">Peso:</span> ${p.peso} kg</p>
          <p><span class="label">Volumen:</span> ${p.volumen || "N/A"} m³</p>
          <p><span class="label">Descripción:</span> ${p.descripcion || "Sin descripción"}</p>
        </div>
        <hr>
        <div class="section">
          <h3>Información de Contacto</h3>
          <p><span class="label">Remitente:</span> ${p.remitente} (${p.telRemitente || "—"})</p>
          <p><span class="label">Destinatario:</span> ${p.destinatario} (${p.telDestinatario || "—"})</p>
        </div>
        <hr>
        <div class="section">
          <h3>Transporte Asignado</h3>
          <p><span class="label">Conductor:</span> ${conductor ? conductor.nombre + " " + conductor.apellido : "No asignado"}</p>
          <p><span class="label">Vehículo / Placa:</span> ${conductor ? conductor.marca + " " + conductor.modelo + " [" + conductor.placa + "]" : "—"}</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(function () {
      printWindow.print();
      printWindow.close();
    }, 250);
  }

  var btnDescargarHoja = document.getElementById("btnDescargarHoja");
  if (btnDescargarHoja) {
    btnDescargarHoja.addEventListener("click", function () {
      if (!selectedCodigo) { 
        showToast("Selecciona un paquete", "Elige un folio de la lista primero."); 
        return; 
      }
      imprimirPedido(selectedCodigo);
    });
  }

  var btnImprimir = document.getElementById("btnImprimir");
  if (btnImprimir) {
    btnImprimir.addEventListener("click", function () {
      if (!selectedCodigo) { 
        showToast("Selecciona un paquete", "Elige un folio de la lista primero."); 
        return; 
      }
      imprimirPedido(selectedCodigo);
    });
  }

  /* ---------- Register form & Preview ---------- */
  var fOrigin = document.getElementById("fOrigin");
  var fDest = document.getElementById("fDest");
  var fWeight = document.getElementById("fWeight");
  var prevRoute = document.getElementById("prevRoute");
  var prevWeight = document.getElementById("prevWeight");
  var prevPriority = document.getElementById("prevPriority");
  var registerForm = document.getElementById("registerForm");

  function updatePreview() {
    if (!fOrigin || !fDest || !fWeight) return;
    var origin = fOrigin.value.trim() || "—";
    var dest = fDest.value.trim() || "—";
    if (prevRoute) prevRoute.textContent = origin + " → " + dest;
    if (prevWeight) prevWeight.textContent = (fWeight.value || "—") + " kg";

    var priority = document.querySelector('input[name="prioridad"]:checked') || document.querySelector('input[name="priority"]:checked');
    if (prevPriority) prevPriority.textContent = priority ? priority.value : "—";
  }

  if (registerForm) {
    ["input", "change"].forEach(function (evt) {
      registerForm.addEventListener(evt, updatePreview);
    });

    // Mantenemos la acción de Cargo.registrarPaquete y permitimos que el formulario envíe a Django
    registerForm.addEventListener("submit", function (e) {
      var priorityElem = document.querySelector('input[name="prioridad"]:checked') || document.querySelector('input[name="priority"]:checked');
      var priorityValue = priorityElem ? priorityElem.value : "Estándar";

      var data = {
        remitente: document.getElementById("fSender") ? document.getElementById("fSender").value : "",
        telRemitente: document.getElementById("fSenderPhone") ? document.getElementById("fSenderPhone").value : "",
        destinatario: document.getElementById("fReceiver") ? document.getElementById("fReceiver").value : "",
        telDestinatario: document.getElementById("fReceiverPhone") ? document.getElementById("fReceiverPhone").value : "",
        origen: fOrigin ? fOrigin.value : "",
        destino: fDest ? fDest.value : "",
        peso: fWeight ? fWeight.value : "",
        volumen: document.getElementById("fVolume") ? document.getElementById("fVolume").value : "",
        descripcion: document.getElementById("fDescription") ? document.getElementById("fDescription").value : "",
        prioridad: priorityValue,
        conductorId: document.getElementById("fConductor") ? document.getElementById("fConductor").value : ""
      };

      if (typeof Cargo !== "undefined" && typeof Cargo.registrarPaquete === "function") {
        var paquete = Cargo.registrarPaquete(data);
        if (paquete) {
          showToast("Paquete guardado", "El paquete se ha procesado con el folio: #" + paquete.codigo);
          renderOrderList();
          selectOrder(paquete.codigo);
        }
      }
    });
  }

  var clearBtn = document.getElementById("clearForm");
  if (clearBtn && registerForm) {
    clearBtn.addEventListener("click", function () {
      registerForm.reset();
      var pStd = document.getElementById("pStd");
      if (pStd) pStd.checked = true;
      updatePreview();
    });
  }

  /* ---------- Init ---------- */
  fillConductorSelect();
  updatePreview();
  renderOrderList();
  if (typeof Cargo !== "undefined" && Cargo.listarPaquetes) {
    var first = Cargo.listarPaquetes()[0];
    if (first) selectOrder(first.codigo);
  }

})();