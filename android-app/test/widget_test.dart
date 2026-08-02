import 'package:ajira_companion/main.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('Ajira app boots', (tester) async {
    await tester.pumpWidget(const AjiraApp());
    expect(find.text('Ajira'), findsWidgets);
  });
}
