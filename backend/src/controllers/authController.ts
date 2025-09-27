import { Request, Response } from "express";
import { Op } from "sequelize";
import { Post, RefreshToken, User } from "../models";
import {
  AuthenticatedRequest,
  CreateUserRequest,
  LoginRequest,
} from "../types";
import { generateToken, verifyRefreshTokenExpiration } from "../utils/jwt";
import dotenv from "dotenv";

dotenv.config();

const JWT_REFRESH_EXPIRES_IN = parseInt(process.env.JWT_REFRESH_EXPIRES_IN as string);

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      username,
      email,
      password,
      firstName,
      lastName,
    }: CreateUserRequest = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ email }, { username }],
      },
    });

    if (existingUser) {
      res.status(409).json({
        error: "User already exists with this email or username",
      });
      return;
    }

    // Create new user
    const user = await User.create({
      username,
      email,
      password,
      firstName,
      lastName,
    });

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      username: user.username,
    });

    // Generate refresh token
    const refreshToken = await RefreshToken.create({
      ownerId: user.id,
      expiresAt: new Date(Date.now() + JWT_REFRESH_EXPIRES_IN * 1000),
    });

    res
      .status(201)
      .cookie("refreshToken", refreshToken.token, {
        httpOnly: true,
        sameSite: 'strict',
      })
      .json({
        message: "User created successfully",
        user: user.toJSON(),
        token,
      });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password }: LoginRequest = req.body;

    // Find user by email
    const user = await User.findOne({ where: { email } });
    if (!user || !user.isActive) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Validate password
    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      username: user.username,
    });

    // Generate refresh token
    const refreshToken = await RefreshToken.create({
      ownerId: user.id,
      expiresAt: new Date(Date.now() + JWT_REFRESH_EXPIRES_IN * 1000),
    });

    res
      .cookie("refreshToken", refreshToken.token, {
        httpOnly: true,
        sameSite: 'strict',
      })
      .status(200)
      .json({
        message: "Login successful",
        user: user.toJSON(),
        token,
      });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getProfile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const user = await User.findByPk(req.user.id, {
      include: [
        {
          model: Post,
          as: "posts",
          attributes: ["id", "title", "createdAt"],
        },
      ],
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.status(200).json({
      user: user.toJSON(),
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateProfile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const { firstName, lastName, avatar } = req.body;

    await user.update({
      firstName,
      lastName,
      avatar,
    });

    res.status(200).json({
      message: "Profile updated successfully",
      user: user.toJSON(),
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const refreshToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  
  try {
    const refreshToken = req.cookies.refreshToken;
  
    // No token provided in cookies
    if(!refreshToken) {
      res.status(401).json({ error: "Access Denied. No refresh token provided."});
      return
    }

    const validRefreshToken = await RefreshToken.findOne({
      where: {
        token: refreshToken
      }
    });

    // Token doens't exist
    if (!validRefreshToken) {
      res.status(400).json({ error: "Invalid refresh token!" });
      return;
    }

    // Token is expired
    if (verifyRefreshTokenExpiration(validRefreshToken)) {

      // Delete expired refresh token
      await validRefreshToken.destroy();
      res.status(403).json({ error: "Refresh token was expired!" });
      return
    }

    const owner = await User.findByPk(validRefreshToken.ownerId) as User;

    // Generate access token
    const accessToken = generateToken({
      id: owner.id,
      email: owner.email,
      username: owner.username
    });

    // Generate refresh token
    const newRefreshToken = await RefreshToken.create({
      ownerId: owner.id,
      expiresAt: new Date(Date.now() + JWT_REFRESH_EXPIRES_IN * 1000),
    });

    // Revoke used refresh token
    await validRefreshToken.destroy();

    res
      .cookie("refreshToken", newRefreshToken.token, {
        httpOnly: true,
        sameSite: 'strict',
      })
      .status(200)
      .json({
        message: "Refresh token successful",
        accessToken,
      });

  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
}