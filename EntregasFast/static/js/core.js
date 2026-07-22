/* ============================================================
   CORE.JS — Capa de datos y utilidades compartidas
   Persistencia real en localStorage (clave "cargoDB").
   Estructura pensada para mapear 1:1 a modelos Django:
   Conductor, Paquete, EventoSeguimiento.
   ============================================================ */
(function (global) {
  "use strict";

  var STORAGE_KEY = "cargoDB_v1";
  var ROLE_KEY = "cargoRole";

  var ESTADOS = [
    "Recibido",
    "En revisión",
    "En bodega",
    "Despachado",
    "En tránsito",
    "Llegó al centro logístico",
    "En distribución",
    "Entregado"
  ];

  var ESTADO_CLASS = {
    "Recibido": "status-checking",
    "En revisión": "status-checking",
    "En bodega": "status-checking",
    "Despachado": "status-transit",
    "En tránsito": "status-transit",
    "Llegó al centro logístico": "status-transit",
    "En distribución": "status-transit",
    "Entregado": "status-delivered"
  };

  function readDB() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      var empty = { conductores: [], paquetes: [], counters: {} };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(empty));
      return empty;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      var fresh = { conductores: [], paquetes: [], counters: {} };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      return fresh;
    }
  }

  function writeDB(db) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }

  function uid(prefix) {
    return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function pad(n, len) {
    var s = String(n);
    while (s.length < len) s = "0" + s;
    return s;
  }

  function generarFolio() {
    var db = readDB();
    var year = new Date().getFullYear();
    var counters = db.counters || {};
    var next = (counters[year] || 0) + 1;
    counters[year] = next;
    db.counters = counters;
    writeDB(db);
    return "CGO-" + year + "-" + pad(next, 6);
  }

  function nowParts() {
    var d = new Date();
    var fecha = d.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" });
    var hora = d.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
    return { fecha: fecha, hora: hora, iso: d.toISOString() };
  }

  function getRole() {
    return localStorage.getItem(ROLE_KEY) || "cliente";
  }
  function setRole(role) {
    localStorage.setItem(ROLE_KEY, role);
  }
  function getUsuarioActual() {
    return getRole() === "administrador" ? "Admin" : "Cliente";
  }

  /* ---------------- Conductores ---------------- */

  function listarConductores() {
    return readDB().conductores.slice().sort(function (a, b) {
      return (a.nombre + a.apellido).localeCompare(b.nombre + b.apellido);
    });
  }

  function obtenerConductor(id) {
    return readDB().conductores.find(function (c) { return c.id === id; }) || null;
  }

  function existeDuplicadoConductor(data, excludeId) {
    var db = readDB();
    return db.conductores.some(function (c) {
      if (excludeId && c.id === excludeId) return false;
      return (
        (data.cedula && c.cedula.trim().toLowerCase() === data.cedula.trim().toLowerCase()) ||
        (data.placa && c.placa.trim().toLowerCase() === data.placa.trim().toLowerCase())
      );
    });
  }

  function guardarConductor(data, id) {
    var db = readDB();
    if (id) {
      var idx = db.conductores.findIndex(function (c) { return c.id === id; });
      if (idx === -1) throw new Error("Conductor no encontrado.");
      data.id = id;
      data.fechaRegistro = db.conductores[idx].fechaRegistro;
      db.conductores[idx] = data;
    } else {
      data.id = uid("drv");
      data.fechaRegistro = nowParts().fecha;
      if (!data.estado) data.estado = "Activo";
      db.conductores.push(data);
    }
    writeDB(db);
    return data;
  }

  function eliminarConductor(id) {
    var db = readDB();
    var enUso = db.paquetes.some(function (p) { return p.conductorId === id; });
    if (enUso) throw new Error("No se puede eliminar: el conductor tiene paquetes asociados. Desactívalo en su lugar.");
    db.conductores = db.conductores.filter(function (c) { return c.id !== id; });
    writeDB(db);
  }

  function cambiarEstadoConductor(id, estado) {
    var db = readDB();
    var c = db.conductores.find(function (x) { return x.id === id; });
    if (!c) throw new Error("Conductor no encontrado.");
    c.estado = estado;
    writeDB(db);
    return c;
  }

  /* ---------------- Paquetes ---------------- */

  function listarPaquetes() {
    return readDB().paquetes.slice().sort(function (a, b) {
      return new Date(b.fechaCreacionISO) - new Date(a.fechaCreacionISO);
    });
  }

  function obtenerPaquete(codigo) {
    return readDB().paquetes.find(function (p) { return p.codigo === codigo; }) || null;
  }

  function registrarPaquete(data) {
    var db = readDB();
    var codigo = generarFolio();
    var t = nowParts();

    var paquete = {
      id: uid("pkg"),
      codigo: codigo,
      remitente: data.remitente,
      telRemitente: data.telRemitente || "",
      destinatario: data.destinatario,
      telDestinatario: data.telDestinatario || "",
      origen: data.origen,
      destino: data.destino,
      peso: data.peso,
      volumen: data.volumen || "",
      descripcion: data.descripcion || "",
      prioridad: data.prioridad,
      servicio: "Terrestre",
      conductorId: data.conductorId,
      usuarioRegistro: getUsuarioActual(),
      fechaCreacion: t.fecha,
      fechaCreacionISO: t.iso,
      estado: ESTADOS[0],
      historial: [
        {
          estado: ESTADOS[0],
          fecha: t.fecha,
          hora: t.hora,
          usuario: getUsuarioActual(),
          observacion: "Paquete registrado en el sistema."
        }
      ]
    };

    db = readDB();
    db.paquetes.push(paquete);
    writeDB(db);
    return paquete;
  }

  function actualizarEstadoPaquete(codigo, nuevoEstado, observacion) {
    var db = readDB();
    var p = db.paquetes.find(function (x) { return x.codigo === codigo; });
    if (!p) throw new Error("Paquete no encontrado.");
    var t = nowParts();
    p.estado = nuevoEstado;
    p.historial.push({
      estado: nuevoEstado,
      fecha: t.fecha,
      hora: t.hora,
      usuario: getUsuarioActual(),
      observacion: observacion || ""
    });
    writeDB(db);
    return p;
  }

  function progresoPorcentaje(estado) {
    var idx = ESTADOS.indexOf(estado);
    if (idx === -1) return 0;
    return Math.round(((idx + 1) / ESTADOS.length) * 100);
  }

  /* ---------------- Filtros / búsqueda ---------------- */

  function filtrarPaquetes(opts) {
    opts = opts || {};
    var q = (opts.query || "").trim().toLowerCase();
    return listarPaquetes().filter(function (p) {
      if (opts.estado && p.estado !== opts.estado) return false;
      if (opts.prioridad && p.prioridad !== opts.prioridad) return false;
      if (opts.conductorId && p.conductorId !== opts.conductorId) return false;
      if (opts.ciudad) {
        var c = opts.ciudad.toLowerCase();
        if (p.origen.toLowerCase().indexOf(c) === -1 && p.destino.toLowerCase().indexOf(c) === -1) return false;
      }
      if (opts.fecha && p.fechaCreacion !== opts.fecha) return false;
      if (q) {
        var conductor = obtenerConductor(p.conductorId);
        var haystack = [
          p.codigo, p.remitente, p.destinatario, p.origen, p.destino,
          conductor ? (conductor.nombre + " " + conductor.apellido) : ""
        ].join(" ").toLowerCase();
        if (haystack.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  global.Cargo = {
    ESTADOS: ESTADOS,
    ESTADO_CLASS: ESTADO_CLASS,
    generarFolio: generarFolio,
    nowParts: nowParts,
    getRole: getRole,
    setRole: setRole,
    getUsuarioActual: getUsuarioActual,
    listarConductores: listarConductores,
    obtenerConductor: obtenerConductor,
    existeDuplicadoConductor: existeDuplicadoConductor,
    guardarConductor: guardarConductor,
    eliminarConductor: eliminarConductor,
    cambiarEstadoConductor: cambiarEstadoConductor,
    listarPaquetes: listarPaquetes,
    obtenerPaquete: obtenerPaquete,
    registrarPaquete: registrarPaquete,
    actualizarEstadoPaquete: actualizarEstadoPaquete,
    progresoPorcentaje: progresoPorcentaje,
    filtrarPaquetes: filtrarPaquetes
  };

})(window);
