extends Node
# Resource updates live outside signed application bundles on every platform.
func _ready() -> void:
	var update := "user://updates/Squarelands.pck"
	if FileAccess.file_exists(update) and not Input.is_physical_key_pressed(KEY_SHIFT):
		if not ProjectSettings.load_resource_pack(ProjectSettings.globalize_path(update),true):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(update))
	var scene = load("res://scenes/main.tscn")
	if scene is PackedScene:
		get_tree().change_scene_to_packed.call_deferred(scene)
	else:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(update))
		push_error("Client update could not start; removed it. Restart to use bundled client.")
		get_tree().quit(1)
