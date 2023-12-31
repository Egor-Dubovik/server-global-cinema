import { Injectable, NotFoundException } from '@nestjs/common';
import { ModelType } from '@typegoose/typegoose/lib/types';
import { Types } from 'mongoose';
import { InjectModel } from 'nestjs-typegoose';
import { ERROR_MESSAGE } from 'src/constant/message/error.message';
import { HashingService } from 'src/hashing/hashing.service';
import { UserUpdateDto } from './dto/updateUser.dto';
import { UserModel } from './user.model';

@Injectable()
export class UserService {
	constructor(
		@InjectModel(UserModel) private readonly UserModel: ModelType<UserModel>,
		private readonly hashingService: HashingService,
	) {}

	async byId(_id: string) {
		const user = this.UserModel.findById(_id);
		if (!user) throw new NotFoundException(ERROR_MESSAGE.USER_NOT_FOUND);
		return user;
	}

	async updateProfile(_id: string, dto: UserUpdateDto, isAdmin = false) {
		const user = await this.byId(_id);
		const isSameUser = await this.UserModel.findOne({ email: dto.email });
		if (isSameUser && String(_id) !== String(isSameUser._id))
			throw new NotFoundException(ERROR_MESSAGE.EMAIL_EXIST);
		if (dto.email) user.email = dto.email;
		if (dto.password) user.password = await this.hashingService.hashPassword(dto.password);
		if ((dto.isAdmin !== undefined && user.isAdmin) || isAdmin) user.isAdmin = dto.isAdmin;
		await user.save();
	}

	async getCount() {
		return this.UserModel.find().count().exec();
	}

	async getAll(searchTerm?: string) {
		let options = {};
		if (searchTerm) {
			options = {
				$or: [{ email: new RegExp(searchTerm, 'i') }],
			};
		}
		return this.UserModel.find(options).select('-password -__v').sort({ createdAt: 'desc' }).exec();
	}

	async delete(id: string) {
		return this.UserModel.findByIdAndDelete(id);
	}

	async toggleFavorites(movieId: Types.ObjectId, user: UserModel) {
		const { _id, favorites } = user;
		await this.UserModel.findByIdAndUpdate(_id, {
			favorites: favorites.includes(movieId)
				? favorites.filter((id) => String(id) !== String(movieId))
				: [...favorites, movieId],
		});
	}

	async getFavoritesMovies(_id: Types.ObjectId) {
		return this.UserModel.findById(_id, 'favorites')
			.populate({
				path: 'favorites',
				populate: {
					path: 'genres',
				},
			})
			.exec()
			.then((data) => data.favorites);
	}
}
