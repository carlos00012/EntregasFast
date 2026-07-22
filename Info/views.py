import json
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import user_passes_test
from django.db.models import Q
from django.core.mail import send_mail
from django.http import JsonResponse
from django.conf import settings
from .models import Conductor, Paquete, HistorialPaquete

# Verificación de que el usuario autenticado sea administrador
def es_admin(user):
    return user.is_authenticated and (user.is_staff or user.is_superuser)


# --- FUNCIÓN AUXILIAR PARA ENVIAR CORREOS ---
def enviar_notificacion_correo(paquete, estado, observacion=""):
    if not paquete.destinatario_correo:
        print(f">>> [CORREO OMISION] El paquete {paquete.codigo} no tiene registrado destinatario_correo.")
        return False

    asunto = f"Notificación de Envío Cargo: Paquete {paquete.codigo}"
    mensaje = (
        f"Hola {paquete.destinatario_nombre},\n\n"
        f"Se ha registrado una actualización para tu paquete con código: {paquete.codigo}\n\n"
        f"Estado actual: {estado}\n"
        f"Origen: {paquete.origen}\n"
        f"Destino: {paquete.destino}\n"
    )

    if observacion:
        mensaje += f"Observaciones: {observacion}\n"

    mensaje += (
        f"\nPuedes verificar el historial de tu paquete ingresando a nuestro sitio de rastreo.\n\n"
        f"Gracias por preferir nuestros servicios."
    )

    try:
        send_mail(
            subject=asunto,
            message=mensaje,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[paquete.destinatario_correo],
            fail_silently=False,  # Cambiado a False para ver errores en la consola si falla SMTP
        )
        print(f">>> ¡CORREO ENVIADO CON ÉXITO A {paquete.destinatario_correo}!")
        return True
    except Exception as e:
        print(f">>> [ERROR CORREO] Fallo al enviar a {paquete.destinatario_correo}: {e}")
        return False


# --- LOGIN / LOGOUT ADMINISTRADOR ---
def login_admin(request):
    if request.user.is_authenticated and es_admin(request.user):
        return redirect('admin_panel')

    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        user = authenticate(request, username=username, password=password)

        if user is not None and es_admin(user):
            login(request, user)
            messages.success(request, f'Bienvenido {user.username}.')
            return redirect('admin_panel')
        else:
            messages.error(request, 'Credenciales incorrectas o no tienes permisos de administrador.')

    return render(request, 'login_admin.html')


def logout_admin(request):
    logout(request)
    messages.info(request, 'Has cerrado sesión correctamente.')
    return redirect('inicio')


# --- PÁGINA INICIAL ---
def inicio(request):
    return render(request, 'inicio.html')


# --- PANEL ADMINISTRADOR (PROTEGIDO) ---
@user_passes_test(es_admin, login_url='login_admin')
def admin_panel(request):
    # Detectar peticiones POST (Normales o enviadas por JS/Fetch)
    if request.method == 'POST':
        data = {}
        if request.content_type == 'application/json':
            try:
                data = json.loads(request.body)
            except json.JSONDecodeError:
                pass
        else:
            data = request.POST

        nuevo_estado = data.get('nuevo_estado') or data.get('estado')
        
        if nuevo_estado:
            codigo_o_id = data.get('paquete_id') or data.get('codigo') or data.get('id')
            observacion = data.get('observacion', '')

            paquete = None
            if codigo_o_id:
                if str(codigo_o_id).isdigit():
                    paquete = Paquete.objects.filter(id=int(codigo_o_id)).first()
                if not paquete:
                    paquete = Paquete.objects.filter(codigo=codigo_o_id).first()

            if paquete:
                paquete.estado_actual = nuevo_estado
                paquete.save()

                HistorialPaquete.objects.create(
                    paquete=paquete,
                    estado=nuevo_estado,
                    observacion=observacion
                )

                # Disparar correo
                enviar_notificacion_correo(paquete, nuevo_estado, observacion)

                if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.content_type == 'application/json':
                    return JsonResponse({'status': 'ok', 'message': f'Estado actualizado a {nuevo_estado}'})

                messages.success(request, f'Estado del paquete {paquete.codigo} actualizado a "{nuevo_estado}".')
                return redirect('admin_panel')

    # GET: Renderizar datos en la vista
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


@user_passes_test(es_admin, login_url='login_admin')
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


@user_passes_test(es_admin, login_url='login_admin')
def actualizar_estado_paquete(request, paquete_id):
    if request.method == 'POST':
        paquete = get_object_or_404(Paquete, id=paquete_id)
        
        data = {}
        if request.content_type == 'application/json':
            try:
                data = json.loads(request.body)
            except json.JSONDecodeError:
                pass
        else:
            data = request.POST

        nuevo_estado = data.get('nuevo_estado') or data.get('estado')
        observacion = data.get('observacion', '')

        if nuevo_estado:
            paquete.estado_actual = nuevo_estado
            paquete.save()

            HistorialPaquete.objects.create(
                paquete=paquete,
                estado=nuevo_estado,
                observacion=observacion
            )

            # Envío de correo al actualizar estado
            enviar_notificacion_correo(paquete, nuevo_estado, observacion)

            if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.content_type == 'application/json':
                return JsonResponse({'status': 'ok', 'message': f'Estado actualizado a {nuevo_estado}'})

            messages.success(request, f'Estado del paquete {paquete.codigo} actualizado.')
    return redirect('admin_panel')


# --- PANEL CLIENTE ---
def dashboard_cliente(request):
    if request.method == 'POST':
        conductor_id = request.POST.get('conductor')

        conductor = None
        if conductor_id and str(conductor_id).isdigit():
            conductor = Conductor.objects.filter(id=int(conductor_id), activo=True).first()

        if not conductor:
            conductor = Conductor.objects.filter(activo=True).first()

        remitente = request.POST.get('remitente')
        remitente_telefono = request.POST.get('remitente_telefono')
        destinatario = request.POST.get('destinatario')
        destinatario_telefono = request.POST.get('destinatario_telefono')
        destinatario_correo = request.POST.get('destinatario_correo')
        origen = request.POST.get('origen')
        destino = request.POST.get('destino')
        peso = request.POST.get('peso') or 0
        volumen = request.POST.get('volumen') or 0
        descripcion = request.POST.get('descripcion')
        prioridad = request.POST.get('prioridad', 'Estándar')

        if conductor:
            paquete = Paquete.objects.create(
                remitente_nombre=remitente,
                remitente_telefono=remitente_telefono,
                destinatario_nombre=destinatario,
                destinatario_telefono=destinatario_telefono,
                destinatario_correo=destinatario_correo,
                origen=origen,
                destino=destino,
                peso_kg=peso,
                volumen_m3=volumen,
                descripcion=descripcion,
                prioridad=prioridad,
                conductor=conductor,
                estado_actual='Registrado'
            )

            HistorialPaquete.objects.create(
                paquete=paquete,
                estado='Registrado',
                observacion='Paquete registrado desde el panel de cliente.'
            )

            messages.success(request, f'Paquete {paquete.codigo} registrado con éxito.')

            if destinatario_correo:
                enviar_notificacion_correo(paquete, 'Registrado', 'Paquete registrado en el sistema.')

        return redirect('dashboard_cliente')

    conductores = Conductor.objects.filter(activo=True)
    return render(request, 'dashboard.html', {
        'conductores': conductores
    })


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