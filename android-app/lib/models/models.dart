class AjiraUser {
  AjiraUser({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    this.phone,
    this.tagline,
    this.bio,
  });

  final String id;
  final String email;
  final String name;
  final String role;
  final String? phone;
  final String? tagline;
  final String? bio;

  bool get isBuyer => role == 'BUYER';
  bool get isSeller => role == 'SELLER';
  bool get isAdmin => role == 'ADMIN';

  factory AjiraUser.fromJson(Map<String, dynamic> json) {
    return AjiraUser(
      id: json['id'] as String,
      email: json['email'] as String,
      name: json['name'] as String,
      role: json['role'] as String,
      phone: json['phone'] as String?,
      tagline: json['tagline'] as String?,
      bio: json['bio'] as String?,
    );
  }
}

class ProjectCard {
  ProjectCard({
    required this.id,
    required this.title,
    required this.status,
    required this.budgetMin,
    required this.budgetMax,
    this.category,
    this.bidCount = 0,
    this.escrowId,
    this.escrowStatus,
  });

  final String id;
  final String title;
  final String status;
  final double budgetMin;
  final double budgetMax;
  final String? category;
  final int bidCount;
  final String? escrowId;
  final String? escrowStatus;

  factory ProjectCard.fromJson(Map<String, dynamic> json) {
    final escrow = json['escrow'] as Map<String, dynamic>?;
    return ProjectCard(
      id: json['id'] as String,
      title: json['title'] as String,
      status: json['status'] as String,
      budgetMin: (json['budgetMin'] as num?)?.toDouble() ?? 0,
      budgetMax: (json['budgetMax'] as num?)?.toDouble() ?? 0,
      category: json['category'] as String?,
      bidCount: (json['bidCount'] as num?)?.toInt() ?? 0,
      escrowId: escrow?['id'] as String?,
      escrowStatus: escrow?['status'] as String?,
    );
  }
}
