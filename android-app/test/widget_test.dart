import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ajira_companion/main.dart';

void main() {
  testWidgets('Ajira app boots', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: AjiraApp()));
    await tester.pump();
    expect(find.byType(AjiraApp), findsOneWidget);
  });
}
