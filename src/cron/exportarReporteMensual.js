const cron = require('node-cron');
const xlsx = require('xlsx');
const nodemailer = require('nodemailer');
const Movement = require('../models/Movement');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');

// Función para generar reporte Excel mensual de movimientos
async function generarReporteMensual(mes, year) {
  const movimientos = await Movement.find({
    fecha: {
      $gte: new Date(year, mes - 1, 1),
      $lt: new Date(year, mes, 1),
    },
  }).lean();

  const datosExcel = movimientos.map((m) => ({
    Usuario: m.usuario_id ? m.usuario_id.toString() : '',
    Fecha: m.fecha.toISOString().substring(0, 10),
    Cantidad: m.cantidad,
    Descripción: m.descripcion || '',
    Tipo: m.tipo || '',
  }));

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(datosExcel);
  xlsx.utils.book_append_sheet(wb, ws, 'Movimientos');

  const tempDir = path.join(__dirname, '..', 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  const filename = `movimientos_${year}_${mes}.xlsx`;
  const filepath = path.join(tempDir, filename);

  xlsx.writeFile(wb, filepath);

  return filepath;
}

// Función para enviar email con adjunto reporte
async function enviarReporteEmail(destinatarios, subject, text, attachmentPath) {
  let transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: { usuario: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

  await transporter.sendMail({
    from: '"Reporte Mensual" <supervitecingenieriasas@gmail.com>',
    to: destinatarios.join(', '),
    subject,
    text,
    attachments: [{ path: attachmentPath }],
  });

  console.log('Correo de reporte enviado a:', destinatarios);
}

// Tarea programada para reporte mensual (día 2 del mes a las 00:05)
function tareaReporteMensual() {
  cron.schedule('5 0 2 * *', async () => {
    try {
      const ahora = new Date();
      const mesActual = ahora.getMonth(); 
      const yearActual = ahora.getFullYear();

      const mesReporte = mesActual === 0 ? 12 : mesActual;
      const yearReporte = mesActual === 0 ? yearActual - 1 : yearActual;

      const filepath = await generarReporteMensual(mesReporte, yearReporte);

      const destinatarios = ['supervitecingenieriasas@gmail.com']; 

      await enviarReporteEmail(
        destinatarios,
        `Reporte de Movimientos - ${mesReporte}/${yearReporte}`,
        'Adjunto el reporte mensual de movimientos.',
        filepath
      );

      fs.unlinkSync(filepath); // Borra archivo temporal después del envío
    } catch (error) {
      console.error('Error en tarea programada reporte mensual:', error);
    }
  });
}

// Tarea programada para limpiar movimientos antiguos (>1 año) (cada domingo 3AM)
function tareaLimpiarMovimientos() {
  cron.schedule('0 3 * * 0', async () => {
    try {
      const fechaCorte = new Date();
      fechaCorte.setFullYear(fechaCorte.getFullYear() - 1);

      const resultado = await Movement.deleteMany({ fecha: { $lt: fechaCorte } });
      console.log(`Limpieza mensual: eliminados ${resultado.deletedCount} movimientos antiguos.`);
    } catch (error) {
      console.error('Error tarea limpieza movimientos:', error);
    }
  });
}

// Tarea programada para notificar usuarios inactivos (>3 meses sin movimiento) (día 1 9AM)
function tareaNotificarUsuariosInactivos() {
  cron.schedule('0 9 1 * *', async () => {
    try {
      const fechaLimite = new Date();
      fechaLimite.setMonth(fechaLimite.getMonth() - 3);

      const usuariosInactivos = await User.find({
        lastMovimientoAt: { $lt: fechaLimite },
      });

      if (usuariosInactivos.length === 0) {
        console.log('No hay usuarios inactivos para notificar');
        return;
      }

      let transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: { usuario: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});


      for (const usuario of usuariosInactivos) {
        await transporter.sendMail({
          from: '"Soporte" <supervitecingenieriasas@gmail.com>',
          to: usuario.correo_electronico,
          subject: 'Estás inactivo, ¿deseas empezar de nuevo?',
          text: `Hola ${usuario.nombre_completo}, hace tiempo que no registras movimientos. ¡Empieza un nuevo recorrido!`,
        });
      }

      console.log(`Notificados ${usuariosInactivos.length} usuarios inactivos.`);
    } catch (error) {
      console.error('Error tarea notificación usuarios inactivos:', error);
    }
  });
}

// Función para iniciar todas las tareas programadas
function iniciarTareasProgramadas() {
  tareaReporteMensual();
  tareaLimpiarMovimientos();
  tareaNotificarUsuariosInactivos();
}

module.exports = iniciarTareasProgramadas;
