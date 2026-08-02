import 'package:flutter/material.dart';

import '../theme.dart';

class StatusChip extends StatelessWidget {
  const StatusChip(this.status, {super.key});
  final String status;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AjiraColors.sand,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        status.replaceAll('_', ' '),
        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AjiraColors.forestDeep),
      ),
    );
  }
}
