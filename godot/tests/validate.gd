extends SceneTree
const Main = preload("res://scripts/main.gd")
const Network = preload("res://scripts/network.gd")
const Map = preload("res://scripts/world_map.gd")
const Art = preload("res://scripts/pixel_art.gd")
const Boot = preload("res://scripts/bootstrap.gd")
func _initialize() -> void:
	print("All native client scripts compiled")
	quit()
