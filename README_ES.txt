PV INSPECTION – VERSIÓN PWA PARA IPHONE

1. Sube el contenido de este paquete (no el ZIP) a la raíz de un proyecto GitLab.
2. Incluye el archivo .gitlab-ci.yml. Su pipeline publica la app en GitLab Pages mediante el directorio public/.
3. Abre Deploy > Pages en GitLab y espera a que el pipeline termine correctamente.
4. Abre dicha dirección en Safari del iPhone, espera a que cargue online y el service worker termine de instalarse.
5. Safari > Compartir > Añadir a pantalla de inicio.
6. Abre el icono y realiza una prueba completa: crear datos, cerrar, reabrir, modo avión, exportar JSON e importarlo.

IMPORTANTE
- Esta versión sigue siendo un PROTOTIPO (catálogo incompleto). No utilizar como único registro oficial de una inspección.
- Los datos permanecen en el almacenamiento local del navegador/dispositivo; GitLab Pages solo entrega archivos estáticos.
- La primera carga requiere Internet; el uso offline depende de haber instalado correctamente los recursos y del almacenamiento disponible.
- iOS puede eliminar datos por gestión de espacio; la persistencia NO está garantizada. Exporta copias JSON a Archivos y otra ubicación independiente regularmente.
- Safari y la aplicación añadida a pantalla de inicio pueden usar almacenes de datos separados; evita cambiar entre ambos para registros de producción y prueba importación/exportación.
- Versión de pruebas sin marca institucional ni logotipos corporativos.
- La publicación de la web es pública. No incluyas datos personales en los archivos de la web o del repositorio. Las inspecciones guardadas localmente no se suben automáticamente a GitLab.
- Para actualizaciones futuras: no renombres el repositorio ni cambies la URL; antes de actualizar, exporta una copia de seguridad.

MIGRACIÓN: si cambias desde otra URL (por ejemplo GitHub Pages), el nuevo origen NO tiene acceso al IndexedDB antiguo. Exporta un backup JSON en la app antigua e impórtalo desde la nueva URL.

V0.4 – Catálogo 2026-IEA-PVFS: 177 Prüfpunkte en 14 áreas; 25 referencias IEA PVFS.
Las evaluaciones de catálogos anteriores con IDs reutilizados se conservan como LEGACY-* para evitar asignar resultados a otra prueba.
Antes de actualizar exportar un backup. Sustituir todos los archivos; la caché cambia de versión.
