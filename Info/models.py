from django.db import models
from django.utils import timezone


class Conductor(models.Model):
    TIPO_LICENCIA_CHOICES = [
        ('A', 'Tipo A'),
        ('B', 'Tipo B'),
        ('C', 'Tipo C'),
        ('D', 'Tipo D'),
        ('E', 'Tipo E'),
    ]

    nombre = models.CharField(max_length=100)
    apellido = models.CharField(max_length=100)
    cedula = models.CharField(max_length=20, unique=True)
    licencia = models.CharField(max_length=50)
    tipo_licencia = models.CharField(max_length=2, choices=TIPO_LICENCIA_CHOICES, default='C')
    telefono = models.CharField(max_length=20)
    correo = models.EmailField(blank=True, null=True)
    placa_vehiculo = models.CharField(max_length=20)
    marca_vehiculo = models.CharField(max_length=50, blank=True, null=True)
    modelo_vehiculo = models.CharField(max_length=50, blank=True, null=True)
    observaciones = models.TextField(blank=True, null=True)
    activo = models.BooleanField(default=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.nombre} {self.apellido} - ({self.placa_vehiculo})"


class Paquete(models.Model):
    PRIORIDAD_CHOICES = [
        ('Estándar', 'Estándar'),
        ('Express', 'Express'),
        ('Urgente', 'Urgente'),
    ]

    ESTADO_CHOICES = [
        ('Registrado', 'Registrado'),
        ('En Bodega', 'En Bodega'),
        ('En Tránsito', 'En Tránsito'),
        ('Entregado', 'Entregado'),
        ('Cancelado', 'Cancelado'),
    ]

    codigo = models.CharField(max_length=30, unique=True, editable=False)
    
    # Remitente y Destinatario
    remitente_nombre = models.CharField(max_length=150)
    remitente_telefono = models.CharField(max_length=20)
    destinatario_nombre = models.CharField(max_length=150)
    destinatario_telefono = models.CharField(max_length=20)
    
    # Ruta y Detalles
    origen = models.CharField(max_length=100)
    destino = models.CharField(max_length=100)
    peso_kg = models.DecimalField(max_digits=8, decimal_places=2)
    volumen_m3 = models.DecimalField(max_digits=8, decimal_places=2, blank=True, null=True)
    fecha_despacho = models.DateField(default=timezone.now)
    descripcion = models.TextField(blank=True, null=True)
    
    # Clasificación y Asignación
    prioridad = models.CharField(max_length=20, choices=PRIORIDAD_CHOICES, default='Estándar')
    estado_actual = models.CharField(max_length=30, choices=ESTADO_CHOICES, default='Registrado')
    conductor = models.ForeignKey(Conductor, on_delete=models.PROTECT, related_name='paquetes')
    
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.codigo:
            # Genera un código automático si no tiene uno (Ejemplo: CGO-2026-000001)
            ultimo_id = Paquete.objects.all().order_by('id').last()
            siguiente_id = (ultimo_id.id + 1) if ultimo_id else 1
            self.codigo = f"CGO-{timezone.now().year}-{siguiente_id:06d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.codigo} ({self.origen} -> {self.destino})"


class HistorialPaquete(models.Model):
    paquete = models.ForeignKey(Paquete, on_delete=models.CASCADE, related_name='historial')
    estado = models.CharField(max_length=30)
    observacion = models.CharField(max_length=255, blank=True, null=True)
    fecha_hora = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha_hora']

    def __str__(self):
        return f"{self.paquete.codigo} - {self.estado} ({self.fecha_hora.strftime('%d/%m/%Y %H:%M')})"