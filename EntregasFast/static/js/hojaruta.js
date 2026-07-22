/* ============================================================
   HOJARUTA.JS — Generación de la Hoja de Ruta en PDF
   Usa jsPDF + QRCode.js (Sin dependencia de JsBarcode).
   ============================================================ */
(function (global) {
  "use strict";

  // Genera una imagen transparente de 1x1px en caso de error o ausencia de QR
  var BLANK_IMG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

  function qrDataURL(text) {
    return new Promise(function (resolve) {
      if (typeof QRCode === "undefined") {
        console.warn("Librería QRCode no disponible. Generando PDF sin QR.");
        resolve(BLANK_IMG);
        return;
      }

      try {
        var holder = document.createElement("div");
        holder.style.display = "none";
        document.body.appendChild(holder);

        /* eslint-disable no-undef */
        new QRCode(holder, {
          text: text,
          width: 220,
          height: 220,
          correctLevel: (typeof QRCode.CorrectLevel !== "undefined") ? QRCode.CorrectLevel.M : 1
        });

        setTimeout(function () {
          var img = holder.querySelector("img");
          var canvas = holder.querySelector("canvas");
          var src = null;

          if (canvas) {
            src = canvas.toDataURL("image/png");
          } else if (img && img.src) {
            src = img.src;
          }

          document.body.removeChild(holder);
          resolve(src || BLANK_IMG);
        }, 120);

      } catch (err) {
        console.warn("Error al intentar construir el QR:", err);
        resolve(BLANK_IMG);
      }
    });
  }

  function urlRastreo(codigo) {
    var base = location.href.replace(/[^/]*$/, "");
    return base + "rastreo.html?codigo=" + encodeURIComponent(codigo);
  }

  function generarHojaDeRuta(codigo) {
    var paquete = Cargo.obtenerPaquete(codigo);
    if (!paquete) {
      alert("No se encontró el paquete " + codigo + ".");
      return;
    }
    var conductor = Cargo.obtenerConductor(paquete.conductorId);

    qrDataURL(urlRastreo(codigo)).then(function (qrImg) {

      // Compatibilidad segura con distintas versiones de jsPDF
      var jsPDFClass = null;
      if (typeof jspdf !== "undefined" && jspdf.jsPDF) {
        jsPDFClass = jspdf.jsPDF;
      } else if (typeof window.jsPDF !== "undefined") {
        jsPDFClass = window.jsPDF;
      } else {
        alert("Error: La librería jsPDF no está disponible.");
        return;
      }

      var doc = new jsPDFClass({ unit: "pt", format: "a4" });
      var pageW = doc.internal.pageSize.getWidth();
      var margin = 40;
      var y = 40;

      /* Encabezado / logo textual */
      doc.setFillColor(28, 35, 51);
      doc.rect(0, 0, pageW, 70, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("Cargo.", margin, 44);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Transporte Terrestre de Carga", margin, 58);

      doc.setFontSize(10);
      doc.text("Hoja de Ruta", pageW - margin, 34, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(codigo, pageW - margin, 52, { align: "right" });

      y = 100;
      doc.setTextColor(28, 35, 51);

      /* QR a la derecha */
      if (qrImg !== BLANK_IMG) {
        doc.addImage(qrImg, "PNG", pageW - margin - 100, y, 100, 100);
      }

      // Texto con el código debajo del QR
      doc.setFontSize(8.5);
      doc.setTextColor(120, 120, 120);
      doc.text(codigo, pageW - margin - 50, y + 112, { align: "center" });
      doc.setTextColor(28, 35, 51);

      function section(title, rows, startY, width) {
        var yy = startY;
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(title, margin, yy);
        yy += 8;
        doc.setDrawColor(230, 230, 230);
        doc.line(margin, yy, margin + width, yy);
        yy += 16;
        doc.setFontSize(9.5);
        rows.forEach(function (r) {
          doc.setFont("helvetica", "bold");
          doc.text(r[0] + ":", margin, yy);
          doc.setFont("helvetica", "normal");
          doc.text(String(r[1] || "—"), margin + 110, yy, { maxWidth: width - 110 });
          yy += 16;
        });
        return yy + 6;
      }

      var colWidth = pageW - margin * 2 - 150;

      y = section("Remitente / Destinatario", [
        ["Remitente", paquete.remitente],
        ["Tel. remitente", paquete.telRemitente],
        ["Destinatario", paquete.destinatario],
        ["Tel. destinatario", paquete.telDestinatario],
        ["Ciudad origen", paquete.origen],
        ["Ciudad destino", paquete.destino]
      ], y, colWidth);

      y = section("Datos del paquete", [
        ["Peso", paquete.peso + " kg"],
        ["Volumen", (paquete.volumen || "—") + (paquete.volumen ? " m³" : "")],
        ["Descripción", paquete.descripcion],
        ["Servicio", "Transporte Terrestre"],
        ["Prioridad", paquete.prioridad],
        ["Estado actual", paquete.estado],
        ["Fecha de registro", paquete.fechaCreacion]
      ], y, colWidth);

      y = section("Conductor / Vehículo", conductor ? [
        ["Conductor", conductor.nombre + " " + conductor.apellido],
        ["Cédula", conductor.cedula],
        ["Licencia", conductor.licencia + " (" + conductor.tipoLicencia + ")"],
        ["Teléfono", conductor.telefono],
        ["Vehículo", conductor.marca + " " + conductor.modelo],
        ["Placa", conductor.placa]
      ] : [["Conductor", "No asignado"]], y, colWidth);

      /* Historial */
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Historial de seguimiento", margin, y);
      y += 8;
      doc.setDrawColor(230, 230, 230);
      doc.line(margin, y, pageW - margin, y);
      y += 16;
      doc.setFontSize(9);

      if (paquete.historial && paquete.historial.length) {
        paquete.historial.forEach(function (h) {
          if (y > 740) { doc.addPage(); y = 40; }
          doc.setFont("helvetica", "bold");
          doc.text(h.estado, margin, y);
          doc.setFont("helvetica", "normal");
          doc.text(h.fecha + " " + h.hora + " · " + h.usuario, margin + 160, y);
          if (h.observacion) {
            y += 12;
            doc.setFontSize(8.5);
            doc.setTextColor(110, 110, 110);
            doc.text(h.observacion, margin + 10, y, { maxWidth: pageW - margin * 2 - 10 });
            doc.setTextColor(28, 35, 51);
            doc.setFontSize(9);
          }
          y += 16;
        });
      }

      /* Firmas */
      if (y > 700) { doc.addPage(); y = 60; }
      y += 20;
      var sigW = (pageW - margin * 2 - 40) / 2;
      doc.setDrawColor(28, 35, 51);
      doc.line(margin, y, margin + sigW, y);
      doc.line(margin + sigW + 40, y, margin + sigW + 40 + sigW, y);
      doc.setFontSize(9);
      doc.text("Firma del operador", margin, y + 14);
      doc.text("Firma del cliente", margin + sigW + 40, y + 14);

      /* Pie de página en todas las páginas */
      var totalPages = doc.internal.getNumberOfPages();
      var nowStr = (typeof Cargo !== "undefined" && Cargo.nowParts) 
        ? Cargo.nowParts().fecha + " " + Cargo.nowParts().hora 
        : new Date().toLocaleString();

      for (var i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        var ph = doc.internal.pageSize.getHeight();
        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);
        doc.text("Impreso: " + nowStr, margin, ph - 20);
        doc.text("Página " + i + " de " + totalPages, pageW - margin, ph - 20, { align: "right" });
      }

      doc.save("hoja-de-ruta-" + codigo + ".pdf");
    }).catch(function (err) {
      alert("Error inesperado al generar el PDF: " + err.message);
    });
  }

  global.CargoPDF = {
    generarHojaDeRuta: generarHojaDeRuta,
    urlRastreo: urlRastreo,
    qrDataURL: qrDataURL
  };

})(window);