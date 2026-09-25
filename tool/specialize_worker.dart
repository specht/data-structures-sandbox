import 'registry.dart';

/// Make a standalone worker for one data structure from the shared trace engine.
///
/// The template contains branch-specific accessors and validation for all supported
/// types, but only the selected branch can execute: main() fixes BrowserSession's
/// kind. Unselected model casts are therefore dynamic and their imports can be
/// removed. This avoids parsing, instrumenting and compiling nine examples on
/// every edit without duplicating the shared trace and validation machinery.
String specializeWorkerTemplate(
  String template, {
  required StructureSpec selected,
  required String id,
  required String sourcePath,
}) {
  final kind = selected.id;
  var text = template.replaceAll('@@ID@@', id).replaceAll('@@KIND@@', kind);
  for (final spec in structures) {
    final studentAlias = '${spec.id}_student';
    final methodsAlias = '${spec.id}_methods';
    final studentImport =
        "import 'generated/$id/${spec.filename}' as $studentAlias;";
    final methodsImport =
        "import 'generated/$id/${spec.id}_methods.dart' as $methodsAlias;";
    if (!text.contains(studentImport) || !text.contains(methodsImport)) {
      throw StateError('Worker template imports changed for ${spec.id}.');
    }
    text = text.replaceAll(
      studentImport,
      spec.id == kind
          ? "import 'generated/$id/${spec.filename}' as selected_student;"
          : '',
    );
    text = text.replaceAll(
      methodsImport,
      spec.id == kind
          ? "import 'generated/$id/${spec.id}_methods.dart' as selected_methods;"
          : '',
    );
    // Constructor calls in unreachable branches may refer to the selected
    // class; the runtime kind is fixed by main() and never changes.
    text = text.replaceAll(
      'instance=$studentAlias.${spec.className}()',
      'instance=selected_student.${selected.className}()',
    );
    text = text.replaceAll(
      'instance as $studentAlias.${spec.className}',
      spec.id == kind
          ? 'instance as selected_student.${selected.className}'
          : 'instance as dynamic',
    );
    // Match method references, not substrings of other aliases or the
    // import filename (which also ends in "_methods.dart").
    text = text.replaceAll(
      RegExp(r'\b' + RegExp.escape(methodsAlias) +
          r'\.(?=(?:invokeDiscovered|discoveredMethodsJson)\b)'),
      'selected_methods.',
    );
    text = text.replaceAll(
      '@@${spec.id.toUpperCase()}_PATH@@',
      spec.id == kind ? sourcePath : '',
    );
  }
  for (final spec in structures) {
    if (text.contains('${spec.id}_student.') ||
        RegExp(r'\b' + RegExp.escape('${spec.id}_methods') +
            r'\.(?=(?:invokeDiscovered|discoveredMethodsJson)\b)').hasMatch(text)) {
      throw StateError('Unresolved worker alias for ${spec.id}.');
    }
  }
  if (text.contains('@@')) {
    throw StateError('Unresolved worker template placeholder.');
  }
  return text;
}
