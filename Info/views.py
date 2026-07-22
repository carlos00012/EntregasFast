from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.db.models import Q
from .models import Conductor, Paquete, HistorialPaquete

# --- PÁGINA INICIAL ---
def inicio(request):
    return render(request, 'inicio.html')


# --- PANEL ADMINISTRADOR ---
def admin_panel(request):
    conductores = Conductor.objects.all()
    paquetes = Paquete.objects.all().select_related('conductor')

    search = request.GET.get('search', '')
    estado = request.GET.get('estado', '')
    prioridad = request.GET.get('prioridad', '')

    if search:
        paquetes = paquetes.filter(
            Q(codigo__icontains=search) |
            Q(remitente_nombre__icontains=search) |
            Q(origen__icontains=search) |
            Q(destino__icontains=search)
        )
    if estado:
        paquetes = paquetes.filter(estado_actual=estado)
    if prioridad:
        paquetes = paquetes.filter(prioridad=prioridad)

    context = {
        'conductores': conductores,
        'paquetes': paquetes,
    }
    return render(request, 'admin.html', context)


def guardar_conductor(request):
    if request.method == 'POST':
        Conductor.objects.create(
            nombre=request.POST.get('nombre'),
            apellido=request.POST.get('apellido'),
            cedula=request.POST.get('cedula'),
            licencia=request.POST.get('licencia'),
            tipo_licencia=request.POST.get('tipo_licencia'),
            telefono=request.POST.get('telefono'),
            correo=request.POST.get('correo'),
            placa_vehiculo=request.POST.get('placa'),
            marca_vehiculo=request.POST.get('marca'),
            modelo_vehiculo=request.POST.get('modelo'),
            observaciones=request.POST.get('observaciones'),
        )
        messages.success(request, 'Conductor registrado con éxito.')
    return redirect('admin_panel')


def actualizar_estado_paquete(request, paquete_id):
    if request.method == 'POST':
        paquete = get_object_or_404(Paquete, id=paquete_id)
        nuevo_estado = request.POST.get('nuevo_estado')
        observacion = request.POST.get('observacion')

        paquete.estado_actual = nuevo_estado
        paquete.save()

        HistorialPaquete.objects.create(
            paquete=paquete,
            estado=nuevo_estado,
            observacion=observacion
        )
        messages.success(request, f'Estado del paquete {paquete.codigo} actualizado.')
    return redirect('admin_panel')


# --- PANEL CLIENTE ---
def dashboard_cliente(request):
    conductores = Conductor.objects.filter(activo=True)
    paquetes = Paquete.objects.all().order_by('-fecha_creacion')

    if request.method == 'POST':
        conductor_id = request.POST.get('conductor')
        conductor = get_object_or_404(Conductor, id=conductor_id)

        paquete = Paquete.objects.create(
            remitente_nombre=request.POST.get('remitente'),
            remitente_telefono=request.POST.get('remitente_telefono'),
            destinatario_nombre=request.POST.get('destinatario'),
            destinatario_telefono=request.POST.get('destinatario_telefono'),
            origen=request.POST.get('origen'),
            destino=request.POST.get('destino'),
            peso_kg=request.POST.get('peso'),
            volumen_m3=request.POST.get('volumen') or None,
            fecha_despacho=request.POST.get('fecha_despacho'),
            descripcion=request.POST.get('descripcion'),
            prioridad=request.POST.get('prioridad', 'Estándar'),
            conductor=conductor
        )

        HistorialPaquete.objects.create(
            paquete=paquete,
            estado='Registrado',
            observacion='Registro inicial de paquete en sistema'
        )

        messages.success(request, f'Paquete {paquete.codigo} registrado exitosamente.')
        return redirect('dashboard_cliente')

    context = {
        'conductores': conductores,
        'paquetes': paquetes,
    }
    return render(request, 'dashboard.html', context)


# --- RASTREO ---
def rastreo_envio(request):
    codigo = request.GET.get('codigo', '').strip().upper()
    paquete = None

    if codigo:
        paquete = Paquete.objects.filter(codigo=codigo).select_related('conductor').first()

    context = {
        'codigo': codigo,
        'paquete': paquete,
    }
    return render(request, 'rastreo.html', context)