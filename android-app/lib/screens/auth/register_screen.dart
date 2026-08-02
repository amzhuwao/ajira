import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../state/auth_controller.dart';
import '../../theme.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  String _role = 'BUYER';
  bool _accept = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_accept) {
      setState(() => _error = 'Accept the Terms to continue.');
      return;
    }
    setState(() => _error = null);
    try {
      await ref.read(authControllerProvider.notifier).register(
            name: _name.text,
            email: _email.text,
            password: _password.text,
            role: _role,
          );
    } catch (e) {
      setState(() => _error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Join Ajira')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          TextField(controller: _name, decoration: const InputDecoration(labelText: 'Full name')),
          const SizedBox(height: 12),
          TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'Email'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _password,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Password (min 8)'),
          ),
          const SizedBox(height: 16),
          Text('I want to', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'BUYER', label: Text('Hire'), icon: Icon(Icons.work_outline)),
              ButtonSegment(value: 'SELLER', label: Text('Work'), icon: Icon(Icons.handshake_outlined)),
            ],
            selected: {_role},
            onSelectionChanged: (s) => setState(() => _role = s.first),
          ),
          const SizedBox(height: 16),
          CheckboxListTile(
            value: _accept,
            onChanged: (v) => setState(() => _accept = v ?? false),
            controlAffinity: ListTileControlAffinity.leading,
            contentPadding: EdgeInsets.zero,
            title: const Text('I accept the Terms and Privacy Policy'),
          ),
          if (_error != null)
            Text(_error!, style: const TextStyle(color: AjiraColors.danger)),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: auth.loading ? null : _submit,
            child: Text(auth.loading ? 'Creating…' : 'Create account'),
          ),
          TextButton(
            onPressed: () => context.go('/login'),
            child: const Text('Already have an account? Sign in'),
          ),
        ],
      ),
    );
  }
}
