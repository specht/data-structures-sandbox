// Run from the project root: dart test/stack_model.dart
import '../templates/example/my_array_stack.dart';

void main() {
  final s = MyArrayStack();
  if (s.top != -1 || !s.isEmpty() || s.peek() != null || s.pop() != null) {
    throw StateError('Empty stack contract failed');
  }
  for (var i = 0; i < 8; i++) {
    if (!s.push(i % 3) || s.top != i || s.memory[i] != i % 3) {
      throw StateError('Push failed at $i');
    }
  }
  if (s.push(99) || s.top != 7 || s.peek() != 1) {
    throw StateError('Full stack must not change');
  }
  for (var i = 7; i >= 0; i--) {
    if (s.pop() != i % 3 || s.top != i - 1 || s.memory[i] != null) {
      throw StateError('Pop failed at $i');
    }
  }
  if (!s.isEmpty() || s.top != -1 || s.pop() != null) {
    throw StateError('Final empty stack failed');
  }
  print('PASS: student-owned top, fixed cells, full/empty, duplicate values, LIFO');
}
