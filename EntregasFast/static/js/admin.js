(function () {
  "use strict";

  Cargo.setRole("administrador");

  /* ---------- Tabs ---------- */
  var switchBtns = document.querySelectorAll(".dash-switch button");
  var panels = {
    paquetes: document.getElementById("panel-paquetes"),
    conductores: document.getElementById("panel-conductores")
  };
  switchBtns.forEach(function (btn) {
    btn.addEventListener("click", function () { activarTab(btn.dataset.panel); });
  });
  function activarTab(key) {
    switchBtns.forEach(function (b) {
      var active = b.dataset.panel === key;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", String(active));
    });
    Object.keys(panels).forEach(function (k) { panels[k].classList.toggle("is-active", k === key); });
  }
  if (location.hash === "#conductores") activarTab("conductores");

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

  /* =========================================================
     PAQUETES
     ========================================================= */
  var aSearch = document.getElementById("aSearch");
  var aEstado = document.getElementById("aEstado");
  var aPrioridad = document.getElementById("aPrioridad");
  var aConductorFiltro = document.getElementById("aConductorFiltro");
  var aCiudad = document.getElementById("aCiudad");
  var aFecha = document.getElementById("aFecha");
  var pkgTableBody = document.getElementById("pkgTableBody");
  var selectedCodigo = null;

  Cargo.ESTADOS.forEach(function (e) {
    var opt = document.createElement("option"); opt.value = e; opt.textContent = e;
    aEstado.appendChild(opt);
  });

  function fillConductorFilter() {
    aConductorFiltro.innerHTML = '<option value="">Todos</option>';
    Cargo.listarConductores().forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c.id; opt.textContent = c.nombre + " " + c.apellido;
      aConductorFiltro.appendChild(opt);
    });
  }

  function renderPkgTable() {
    var items = Cargo.filtrarPaquetes({
      query: aSearch.value,
      estado: aEstado.value,
      prioridad: aPrioridad.value,
      conductorId: aConductorFiltro.value,
      ciudad: aCiudad.value,
      fecha: aFecha.value
    });

    pkgTableBody.innerHTML = "";
    if (!items.length) {
      pkgTableBody.innerHTML = '<tr><td colspan="7"><div class="empty-state">No hay paquetes que coincidan con los filtros.</div></td></tr>';
      return;
    }

    items.forEach(function (p) {
      var conductor = Cargo.obtenerConductor(p.conductorId);
      var cls = Cargo.ESTADO_CLASS[p.estado] || "status-checking";
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td><strong>' + p.codigo + '</strong></td>' +
        '<td>' + p.origen + ' → ' + p.destino + '</td>' +
        '<td>' + p.remitente + '</td>' +
        '<td>' + (conductor ? conductor.nombre + " " + conductor.apellido : "—") + '</td>' +
        '<td>' + p.prioridad + '</td>' +
        '<td><span class="status-badge ' + cls + '">' + p.estado + '</span></td>' +
        '<td><button type="button" class="btn-outline btn-sm" data-codigo="' + p.codigo + '">Gestionar</button></td>';
      pkgTableBody.appendChild(tr);
    });
  }

  pkgTableBody.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-codigo]");
    if (btn) seleccionarPaquete(btn.dataset.codigo);
  });

  [aSearch, aEstado, aPrioridad, aConductorFiltro, aCiudad, aFecha].forEach(function (el) {
    el.addEventListener("input", renderPkgTable);
    el.addEventListener("change", renderPkgTable);
  });
  document.getElementById("aLimpiarFiltros").addEventListener("click", function () {
    aSearch.value = ""; aEstado.value = ""; aPrioridad.value = "";
    aConductorFiltro.value = ""; aCiudad.value = ""; aFecha.value = "";
    renderPkgTable();
  });

  var pkgDetailPanel = document.getElementById("pkgDetailPanel");
  var pdCodigo = document.getElementById("pdCodigo");
  var pdSummary = document.getElementById("pdSummary");
  var pdTimeline = document.getElementById("pdTimeline");
  var pdNuevoEstado = document.getElementById("pdNuevoEstado");
  Cargo.ESTADOS.forEach(function (e) {
    var opt = document.createElement("option"); opt.value = e; opt.textContent = e;
    pdNuevoEstado.appendChild(opt);
  });

  function seleccionarPaquete(codigo) {
    selectedCodigo = codigo;
    var p = Cargo.obtenerPaquete(codigo);
    if (!p) return;
    pkgDetailPanel.style.display = "";
    pdCodigo.textContent = "#" + p.codigo;

    var conductor = Cargo.obtenerConductor(p.conductorId);
    pdSummary.innerHTML =
      '<div class="stat"><div class="k">Ruta</div><div class="v">' + p.origen + ' → ' + p.destino + '</div></div>' +
      '<div class="stat"><div class="k">Estado</div><div class="v">' + p.estado + '</div></div>' +
      '<div class="stat"><div class="k">Prioridad</div><div class="v">' + p.prioridad + '</div></div>' +
      '<div class="stat"><div class="k">Conductor</div><div class="v">' + (conductor ? conductor.nombre + " " + conductor.apellido : "No asignado") + '</div></div>' +
      '<div class="stat"><div class="k">Remitente</div><div class="v">' + p.remitente + '</div></div>' +
      '<div class="stat"><div class="k">Destinatario</div><div class="v">' + p.destinatario + '</div></div>' +
      '<div class="stat"><div class="k">Peso</div><div class="v">' + p.peso + ' kg</div></div>' +
      '<div class="stat"><div class="k">Volumen</div><div class="v">' + (p.volumen || "—") + '</div></div>';

    pdNuevoEstado.value = p.estado;
    renderTimeline(p);
  }

  function renderTimeline(p) {
    pdTimeline.innerHTML = "";
    p.historial.slice().reverse().forEach(function (h, idx) {
      var div = document.createElement("div");
      div.className = "tt-step done" + (idx === 0 ? " current" : "");
      div.innerHTML =
        '<div class="tt-dot"></div>' +
        '<div class="tt-title">' + h.estado + '</div>' +
        '<div class="tt-meta">' + h.fecha + ' · ' + h.hora + ' — ' + h.usuario + '</div>' +
        (h.observacion ? '<div class="tt-obs">' + h.observacion + '</div>' : "");
      pdTimeline.appendChild(div);
    });
  }

  document.getElementById("pdActualizar").addEventListener("click", function () {
    if (!selectedCodigo) return;
    var obs = document.getElementById("pdObservacion").value.trim();
    var p = Cargo.actualizarEstadoPaquete(selectedCodigo, pdNuevoEstado.value, obs);
    document.getElementById("pdObservacion").value = "";
    renderTimeline(p);
    renderPkgTable();
    seleccionarPaquete(selectedCodigo);
    showToast("Estado actualizado", "Folio #" + p.codigo + " ahora está en: " + p.estado + ".");
  });

  /* ---------- QR / PDF / imprimir desde admin ---------- */
  var qrModalOverlay = document.getElementById("qrModalOverlay");
  var qrModalCodigo = document.getElementById("qrModalCodigo");
  var qrCanvasHolder = document.getElementById("qrCanvasHolder");
  document.getElementById("pdVerQR").addEventListener("click", function () {
    if (!selectedCodigo) return;
    qrModalCodigo.textContent = selectedCodigo;
    qrCanvasHolder.innerHTML = "";
    new QRCode(qrCanvasHolder, { text: CargoPDF.urlRastreo(selectedCodigo), width: 200, height: 200 });
    qrModalOverlay.classList.add("is-shown");
  });
  document.getElementById("closeQrModal").addEventListener("click", function () {
    qrModalOverlay.classList.remove("is-shown");
  });
  qrModalOverlay.addEventListener("click", function (e) {
    if (e.target === qrModalOverlay) qrModalOverlay.classList.remove("is-shown");
  });
  document.getElementById("pdDescargar").addEventListener("click", function () {
    if (selectedCodigo) CargoPDF.generarHojaDeRuta(selectedCodigo);
  });
  document.getElementById("pdImprimir").addEventListener("click", function () { window.print(); });

  /* =========================================================
     CONDUCTORES
     ========================================================= */
  var driverForm = document.getElementById("driverForm");
  var driverTableBody = document.getElementById("driverTableBody");
  var driverFormTitle = document.getElementById("driverFormTitle");
  var dCancelarEdicion = document.getElementById("dCancelarEdicion");
  var dId = document.getElementById("dId");

  var driverFields = ["dNombre", "dApellido", "dCedula", "dLicencia", "dTipoLicencia", "dTelefono", "dCorreo", "dPlaca", "dMarca", "dModelo", "dObservaciones"];

  function limpiarFormularioConductor() {
    driverForm.reset();
    dId.value = "";
    driverFormTitle.textContent = "Registrar conductor";
    dCancelarEdicion.style.display = "none";
  }

  function renderDriverTable() {
    var conductores = Cargo.listarConductores();
    driverTableBody.innerHTML = "";
    if (!conductores.length) {
      driverTableBody.innerHTML = '<tr><td colspan="6"><div class="empty-state">Aún no hay conductores registrados.</div></td></tr>';
      return;
    }
    conductores.forEach(function (c) {
      var tr = document.createElement("tr");
      var pill = c.estado === "Activo" ? '<span class="pill pill-on">Activo</span>' : '<span class="pill pill-off">Inactivo</span>';
      tr.innerHTML =
        '<td><strong>' + c.nombre + ' ' + c.apellido + '</strong></td>' +
        '<td>' + c.cedula + '</td>' +
        '<td>' + (c.marca || "") + ' ' + (c.modelo || "") + '<br><small>' + c.placa + '</small></td>' +
        '<td>' + c.telefono + '</td>' +
        '<td>' + pill + '</td>' +
        '<td><div class="driver-actions">' +
          '<button type="button" class="btn-ghost btn-sm" data-action="edit" data-id="' + c.id + '">Editar</button>' +
          '<button type="button" class="btn-ghost btn-sm" data-action="toggle" data-id="' + c.id + '">' + (c.estado === "Activo" ? "Desactivar" : "Activar") + '</button>' +
          '<button type="button" class="btn-danger" data-action="delete" data-id="' + c.id + '">Eliminar</button>' +
        '</div></td>';
      driverTableBody.appendChild(tr);
    });
    fillConductorFilter();
  }

  driverForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var data = {
      nombre: document.getElementById("dNombre").value.trim(),
      apellido: document.getElementById("dApellido").value.trim(),
      cedula: document.getElementById("dCedula").value.trim(),
      licencia: document.getElementById("dLicencia").value.trim(),
      tipoLicencia: document.getElementById("dTipoLicencia").value,
      telefono: document.getElementById("dTelefono").value.trim(),
      correo: document.getElementById("dCorreo").value.trim(),
      placa: document.getElementById("dPlaca").value.trim(),
      marca: document.getElementById("dMarca").value.trim(),
      modelo: document.getElementById("dModelo").value.trim(),
      observaciones: document.getElementById("dObservaciones").value.trim(),
      estado: "Activo"
    };

    if (!data.nombre || !data.apellido || !data.cedula || !data.licencia || !data.telefono || !data.placa) {
      showToast("Faltan datos", "Completa los campos obligatorios del conductor.");
      return;
    }

    var editId = dId.value || null;
    if (editId) {
      var existente = Cargo.obtenerConductor(editId);
      data.estado = existente.estado;
    }

    if (Cargo.existeDuplicadoConductor(data, editId)) {
      showToast("Conductor duplicado", "Ya existe un conductor con esa cédula o placa.");
      return;
    }

    try {
      var conductor = Cargo.guardarConductor(data, editId);
      showToast(editId ? "Conductor actualizado" : "Conductor registrado", conductor.nombre + " " + conductor.apellido + " guardado correctamente.");
      limpiarFormularioConductor();
      renderDriverTable();
      fillConductorFilter();
    } catch (err) {
      showToast("Error", err.message);
    }
  });

  driverTableBody.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-action]");
    if (!btn) return;
    var id = btn.dataset.id;
    var action = btn.dataset.action;

    if (action === "edit") {
      var c = Cargo.obtenerConductor(id);
      if (!c) return;
      dId.value = c.id;
      document.getElementById("dNombre").value = c.nombre;
      document.getElementById("dApellido").value = c.apellido;
      document.getElementById("dCedula").value = c.cedula;
      document.getElementById("dLicencia").value = c.licencia;
      document.getElementById("dTipoLicencia").value = c.tipoLicencia;
      document.getElementById("dTelefono").value = c.telefono;
      document.getElementById("dCorreo").value = c.correo || "";
      document.getElementById("dPlaca").value = c.placa;
      document.getElementById("dMarca").value = c.marca || "";
      document.getElementById("dModelo").value = c.modelo || "";
      document.getElementById("dObservaciones").value = c.observaciones || "";
      driverFormTitle.textContent = "Editar conductor";
      dCancelarEdicion.style.display = "";
      activarTab("conductores");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    if (action === "toggle") {
      var conductor = Cargo.obtenerConductor(id);
      if (!conductor) return;
      var nuevoEstado = conductor.estado === "Activo" ? "Inactivo" : "Activo";
      Cargo.cambiarEstadoConductor(id, nuevoEstado);
      renderDriverTable();
      showToast("Estado actualizado", conductor.nombre + " ahora está " + nuevoEstado.toLowerCase() + ".");
    }

    if (action === "delete") {
      if (!confirm("¿Eliminar este conductor? Esta acción no se puede deshacer.")) return;
      try {
        Cargo.eliminarConductor(id);
        renderDriverTable();
        showToast("Conductor eliminado", "El registro se eliminó correctamente.");
      } catch (err) {
        showToast("No se pudo eliminar", err.message);
      }
    }
  });

  dCancelarEdicion.addEventListener("click", limpiarFormularioConductor);

  /* ---------- Init ---------- */
  fillConductorFilter();
  renderPkgTable();
  renderDriverTable();
  var first = Cargo.listarPaquetes()[0];
  if (first) seleccionarPaquete(first.codigo);

})();
